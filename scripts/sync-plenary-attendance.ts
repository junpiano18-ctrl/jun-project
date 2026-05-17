// 22대 본회의 출석률 — 의원별 집계 (본회의 개의 일자 기준).
//   npx tsx scripts/sync-plenary-attendance.ts
//
// "본회의 출석률"의 두 가지 정의:
//   (a) 표결 참여율: 표결 안건 단위 = 의원이 참여한 표결 수 / 전체 표결 수
//   (b) 회의 출석률: 개의 일자 단위 = 의원이 참여한 본회의 날짜 수 / 전체 개의 일자 수
//
// K-Assembly 등 외부 사이트는 (b) 사용. 우리도 (b)로 통일.
// 한 개의 본회의 날짜에는 보통 10~30건의 안건이 표결되므로 (a)는 비현실적으로 높게 나옴.
//
// 1) ncocpgfiaoituanbr (의안별 표결현황) → 22대 본회의 표결 안건 + PROC_DT(처리일자)
// 2) 각 BILL_ID로 nojepdqqaweusdfbi (본회의 표결정보) → 그 안건에 참여한 의원 row
// 3) 의원별로 자신이 참여한 BILL_ID들의 PROC_DT를 모은 Set 크기 = 출석 일수
// 4) 전체 PROC_DT Set 크기 = 본회의 개의 일수
// 5) plenaryVoteSessionCount = 본회의 일수, plenaryVoteAttendCount = 출석 일수
//
// 호출량: 1 + 1,595 페이지 = 약 3분 소요

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const STATS_EP = "https://open.assembly.go.kr/portal/openapi/ncocpgfiaoituanbr";
const VOTE_EP = "https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi";
const UA = "naemeosum/0.1 (https://naemeosum.com; contact: junpiano18@gmail.com)";
const AGE = "22";
const PAGE_SIZE = 1000;
const SLEEP_MS = 110;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// PROC_DT="2026-05-07" 형태. BILL_ID와 함께 반환.
type StatsRow = { BILL_ID: string; PROC_DT?: string };
type VoteRow = { MONA_CD?: string };

async function fetchAllBills(key: string): Promise<Array<{ billId: string; procDt: string }>> {
  const out: Array<{ billId: string; procDt: string }> = [];
  let total = 0;
  for (let pIndex = 1; ; pIndex++) {
    const url = new URL(STATS_EP);
    url.searchParams.set("KEY", key);
    url.searchParams.set("Type", "json");
    url.searchParams.set("AGE", AGE);
    url.searchParams.set("pIndex", String(pIndex));
    url.searchParams.set("pSize", String(PAGE_SIZE));
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} on stats page ${pIndex}`);
    const json = (await res.json()) as {
      ncocpgfiaoituanbr?: Array<
        | { head: Array<{ list_total_count?: number }> }
        | { row: StatsRow[] }
      >;
    };
    const block = json.ncocpgfiaoituanbr ?? [];
    let pageRows: StatsRow[] = [];
    for (const b of block) {
      if ("head" in b) {
        const h = b.head.find((x) => "list_total_count" in x)?.list_total_count;
        if (h) total = h;
      } else if ("row" in b) {
        pageRows = b.row;
      }
    }
    for (const r of pageRows) {
      if (r.BILL_ID && r.PROC_DT) {
        out.push({ billId: r.BILL_ID, procDt: r.PROC_DT });
      }
    }
    if (out.length >= total || pageRows.length === 0) break;
    await sleep(SLEEP_MS);
  }
  return out;
}

async function fetchVoteRows(key: string, billId: string): Promise<VoteRow[]> {
  const url = new URL(VOTE_EP);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("AGE", AGE);
  url.searchParams.set("BILL_ID", billId);
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", String(PAGE_SIZE));
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on BILL_ID ${billId}`);
  const json = (await res.json()) as {
    nojepdqqaweusdfbi?: Array<
      | { head: Array<{ list_total_count?: number; RESULT?: { CODE: string } }> }
      | { row: VoteRow[] }
    >;
  };
  const block = json.nojepdqqaweusdfbi ?? [];
  for (const b of block) {
    if ("row" in b) return b.row;
  }
  return [];
}

async function main() {
  const key = process.env.OPEN_ASSEMBLY_VOTE_KEY;
  if (!key) { console.error("✗ OPEN_ASSEMBLY_VOTE_KEY 비어 있음"); process.exit(1); }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    console.log("22대 본회의 표결 안건 + PROC_DT fetch...");
    const bills = await fetchAllBills(key);
    console.log(`  ${bills.length} 안건 추출`);

    const allDates = new Set<string>();
    for (const b of bills) allDates.add(b.procDt);
    console.log(`  본회의 개의 일수 ${allDates.size}일`);

    console.log("\n각 BILL_ID 표결 row fetch + 의원별 참여일 집계...");
    // monaCd → 그 의원이 참여한 PROC_DT Set
    const attendDates = new Map<string, Set<string>>();
    let done = 0;
    for (const { billId, procDt } of bills) {
      try {
        const rows = await fetchVoteRows(key, billId);
        const seen = new Set<string>();
        for (const r of rows) {
          if (r.MONA_CD && !seen.has(r.MONA_CD)) {
            seen.add(r.MONA_CD);
            const set = attendDates.get(r.MONA_CD) ?? new Set<string>();
            set.add(procDt);
            attendDates.set(r.MONA_CD, set);
          }
        }
      } catch (e) {
        console.error(`\n  ✗ ${billId}: ${(e as Error).message}`);
      }
      done++;
      if (done % 50 === 0 || done === bills.length) {
        process.stdout.write(`\r  ${done}/${bills.length}`);
      }
      await sleep(SLEEP_MS);
    }
    process.stdout.write("\n");

    console.log(`\n참여 데이터 있는 의원 ${attendDates.size}명`);

    const totalDays = allDates.size;
    const terms = await prisma.politicianTerm.findMany({
      where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
      include: { politician: true },
    });

    let updated = 0;
    for (const t of terms) {
      if (!t.politician.monaCd) continue;
      const dates = attendDates.get(t.politician.monaCd);
      const attendedDays = dates ? dates.size : 0;
      const rate = totalDays > 0 ? attendedDays / totalDays : null;
      await prisma.politicianTerm.update({
        where: { id: t.id },
        data: {
          plenaryVoteSessionCount: totalDays,
          plenaryVoteAttendCount: attendedDays,
          attendanceRate: rate,
        },
      });
      updated++;
    }
    console.log(`✓ ${updated}/${terms.length} 의원 update`);

    // 검증: 정청래 + 상위 5명
    const jcrDates = attendDates.get("2385336L");
    if (jcrDates) {
      const rate = ((jcrDates.size / totalDays) * 100).toFixed(1);
      console.log(
        `\n[정청래] ${jcrDates.size}/${totalDays} (${rate}%) ← 사용자 보고 79/91 = 86.8%와 비교`,
      );
    }
    const sorted = [...attendDates.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 5);
    console.log("\n출석 상위 5명:");
    for (const [monaCd, set] of sorted) {
      const t = terms.find((x) => x.politician.monaCd === monaCd);
      const rate = ((set.size / totalDays) * 100).toFixed(1);
      console.log(
        `  ${t?.politician.name ?? "(?)"} (${monaCd}) — ${set.size}/${totalDays} (${rate}%)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
