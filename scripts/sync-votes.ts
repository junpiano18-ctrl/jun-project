// 본회의 표결 동기화 — nojepdqqaweusdfbi (의안 단위 호출).
//   npx tsx scripts/sync-votes.ts [--limit N] [--politician 이름]
//
// 전략:
//   1) Bill 테이블의 PASSED/REJECTED 의안 (본회의 부의된 의안들) 목록을 가져옴.
//   2) 의안별로 nojepdqqaweusdfbi 호출 → 모든 의원의 찬/반/기/불 row 수신.
//   3) MONA_CD로 우리 Politician과 매칭, 매칭되는 row만 VoteRecord upsert.
//   4) --politician 옵션은 "그 의원이 표결한 의안만" 출력 (테스트용).
//   5) --limit N으로 처리할 의안 수 제한 (테스트용).
//
// 멱등: 동일 (politicianId, billId)는 upsert로 덮어씀.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const VOTE_ENDPOINT = "https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi";
const PROC_LAW_ENDPOINT = "https://open.assembly.go.kr/portal/openapi/nwbpacrgavhjryiph"; // 본회의 처리안건_법률안
const PROC_ETC_ENDPOINT = "https://open.assembly.go.kr/portal/openapi/nbslryaradshbpbpm"; // 본회의 처리안건_기타
const SLEEP_MS = 150;

type Row = {
  HG_NM?: string;
  POLY_NM?: string;
  MONA_CD?: string;
  VOTE_DATE?: string; // "20260507 170551"
  BILL_NO?: string;
  BILL_NAME?: string;
  BILL_ID?: string;
  BILL_URL?: string;
  RESULT_VOTE_MOD?: string; // "찬성"/"반대"/"기권"/"불참"
  SESSION_CD?: number | string;
  CURRENTS_CD?: number | string;
  AGE?: number | string;
};

type ApiResponse =
  | { nojepdqqaweusdfbi: Array<{ head?: Array<Record<string, unknown>>; row?: Row[] }> }
  | { RESULT: { CODE: string; MESSAGE: string } };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let politician: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit") limit = Number(args[++i]);
    else if (args[i] === "--politician") politician = args[++i] ?? null;
  }
  return { limit, politician };
}

function parseVoteDate(s: string | undefined): Date | null {
  if (!s) return null;
  // "20260507 170551" → 2026-05-07T17:05:51
  const m = s.match(/^(\d{4})(\d{2})(\d{2})\s*(\d{2})?(\d{2})?(\d{2})?$/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  return new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}+09:00`);
}

function mapResult(s: string | undefined): "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT" | null {
  switch ((s ?? "").trim()) {
    case "찬성": return "AGREE";
    case "반대": return "DISAGREE";
    case "기권": return "ABSTAIN";
    case "불참": return "ABSENT";
    default: return null;
  }
}

async function fetchVotesForBill(key: string, billId: string): Promise<Row[]> {
  const url = new URL(VOTE_ENDPOINT);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "500");
  url.searchParams.set("AGE", "22");
  url.searchParams.set("BILL_ID", billId);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 naemeosum/0.1" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as ApiResponse;
  if ("RESULT" in json) {
    if (json.RESULT.CODE === "INFO-200") return [];
    throw new Error(`${json.RESULT.CODE} ${json.RESULT.MESSAGE}`);
  }
  const blocks = json.nojepdqqaweusdfbi ?? [];
  for (const b of blocks) {
    if (b.row) return b.row;
  }
  return [];
}

type ProcRow = {
  BILL_ID?: string;
  BILL_NM?: string;
  VOTE_TCNT?: number | string;
  YES_TCNT?: number | string;
  NO_TCNT?: number | string;
  BLANK_TCNT?: number | string;
  LAW_PROC_DT?: string | null;
};

// 본회의 처리 안건 마스터 list (법률안 + 기타). VOTE_TCNT > 0 인 것만 = 실제 본회의 표결 발생.
async function fetchProcessedBills(
  key: string,
  endpoint: string,
  topName: string,
): Promise<ProcRow[]> {
  const all: ProcRow[] = [];
  let pIndex = 1;
  const pSize = 500;
  while (true) {
    const url = new URL(endpoint);
    url.searchParams.set("KEY", key);
    url.searchParams.set("Type", "json");
    url.searchParams.set("pIndex", String(pIndex));
    url.searchParams.set("pSize", String(pSize));
    url.searchParams.set("AGE", "22");
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const json = (await res.json()) as Record<string, unknown>;
    if (json.RESULT) {
      const r = json.RESULT as { CODE?: string };
      if (r.CODE === "INFO-200") break;
      throw new Error(`${(json.RESULT as { CODE?: string }).CODE}`);
    }
    const blocks = (json[topName] ?? []) as Array<{ row?: ProcRow[] }>;
    let rows: ProcRow[] = [];
    for (const b of blocks) if (b.row) rows = b.row;
    all.push(...rows);
    if (rows.length < pSize) break;
    pIndex++;
    await sleep(150);
  }
  return all;
}

async function main() {
  const { limit, politician } = parseArgs();
  const key = process.env.OPEN_ASSEMBLY_API_KEY;
  if (!key) {
    console.error("✗ OPEN_ASSEMBLY_API_KEY 비어 있음");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    // monaCd → politicianId 매핑 캐시
    const allPols = await prisma.politician.findMany({
      where: { monaCd: { not: null } },
      select: { id: true, monaCd: true, name: true },
    });
    const polByMona = new Map(allPols.filter((p) => p.monaCd).map((p) => [p.monaCd!, p]));
    console.log(`Politician 매핑: ${polByMona.size}명`);

    // 대상 의안 = 본회의 처리안건 (법률안 + 기타). VOTE_TCNT > 0 만 (실제 표결 발생).
    // Bill 테이블의 PASSED는 위원회 가결도 포함해 부정확.
    console.log("본회의 처리 안건 list 받는 중...");
    const procLaw = await fetchProcessedBills(key, PROC_LAW_ENDPOINT, "nwbpacrgavhjryiph");
    const procEtc = await fetchProcessedBills(key, PROC_ETC_ENDPOINT, "nbslryaradshbpbpm");
    const merged = [...procLaw, ...procEtc].filter(
      (b) => b.BILL_ID && Number(b.VOTE_TCNT ?? 0) > 0,
    );

    // Bill 테이블의 voteTcnt/yesTcnt 등 집계 update (Bill에 없는 BILL_ID는 skip).
    console.log("Bill 표결 집계 update 중...");
    let tallyUpdated = 0;
    for (const b of merged) {
      const res = await prisma.bill.updateMany({
        where: { billId: b.BILL_ID! },
        data: {
          voteTcnt: Number(b.VOTE_TCNT ?? 0),
          yesTcnt: b.YES_TCNT !== undefined ? Number(b.YES_TCNT) : null,
          noTcnt: b.NO_TCNT !== undefined ? Number(b.NO_TCNT) : null,
          blankTcnt: b.BLANK_TCNT !== undefined ? Number(b.BLANK_TCNT) : null,
        },
      });
      tallyUpdated += res.count;
    }
    console.log(`  ✓ Bill 집계 update ${tallyUpdated}건`);

    let bills = merged.map((b) => ({
      billId: b.BILL_ID!,
      billName: b.BILL_NM ?? "(이름 미상)",
    }));
    // 중복 BILL_ID 제거
    const seen = new Set<string>();
    bills = bills.filter((b) => { if (seen.has(b.billId)) return false; seen.add(b.billId); return true; });
    if (limit) bills = bills.slice(0, limit);
    console.log(`대상 의안 ${bills.length}건${limit ? ` (--limit ${limit})` : ""} (법률안 ${procLaw.length} + 기타 ${procEtc.length})`);

    const targetMonaCd = politician
      ? allPols.find((p) => p.name === politician)?.monaCd
      : null;
    if (politician && !targetMonaCd) {
      console.warn(`  ⚠ "${politician}" 매칭 실패`);
    }

    let billsProcessed = 0;
    let votesUpserted = 0;
    let skippedNoMatch = 0;
    const startedAt = Date.now();

    for (const b of bills) {
      let rows: Row[];
      try {
        rows = await fetchVotesForBill(key, b.billId);
      } catch (e) {
        console.error(`  ✗ ${b.billId}: ${(e as Error).message}`);
        await sleep(SLEEP_MS);
        continue;
      }
      let billUpserts = 0;
      for (const r of rows) {
        if (targetMonaCd && r.MONA_CD !== targetMonaCd) continue;
        const pol = r.MONA_CD ? polByMona.get(r.MONA_CD) : null;
        if (!pol) { skippedNoMatch++; continue; }
        const result = mapResult(r.RESULT_VOTE_MOD);
        const voteDate = parseVoteDate(r.VOTE_DATE);
        if (!result || !voteDate) { skippedNoMatch++; continue; }

        await prisma.voteRecord.upsert({
          where: { politicianId_billId: { politicianId: pol.id, billId: r.BILL_ID ?? b.billId } },
          create: {
            politicianId: pol.id,
            billId: r.BILL_ID ?? b.billId,
            billName: r.BILL_NAME ?? b.billName,
            voteDate,
            result,
            billUrl: r.BILL_URL ?? null,
            sessionCd: r.SESSION_CD !== undefined ? Number(r.SESSION_CD) : null,
            currentsCd: r.CURRENTS_CD !== undefined ? Number(r.CURRENTS_CD) : null,
            age: r.AGE !== undefined ? Number(r.AGE) : 22,
          },
          update: {
            billName: r.BILL_NAME ?? b.billName,
            voteDate,
            result,
            billUrl: r.BILL_URL ?? null,
          },
        });
        billUpserts++;
        votesUpserted++;
      }
      billsProcessed++;
      if (politician || (limit && limit <= 20)) {
        console.log(
          `  ✓ ${b.billId.slice(0, 14)}… ${b.billName.slice(0, 40)} (${rows.length} rows, ${billUpserts} upserted)`,
        );
      } else if (billsProcessed % 50 === 0) {
        const rate = billsProcessed / ((Date.now() - startedAt) / 1000);
        const remainSec = Math.round((bills.length - billsProcessed) / rate);
        console.log(
          `  진행 ${billsProcessed}/${bills.length} (${rate.toFixed(2)} bill/s, 남은 시간 ~${Math.round(remainSec / 60)}분, upsert ${votesUpserted})`,
        );
      }
      await sleep(SLEEP_MS);
    }

    console.log(`\n✓ 의안 ${billsProcessed}건 처리, VoteRecord upsert ${votesUpserted}건${skippedNoMatch ? ` (skip ${skippedNoMatch})` : ""}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
