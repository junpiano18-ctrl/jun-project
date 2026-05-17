// 22대 발의법률안 전체를 다운로드해 의원별 (대표발의자) 집계.
//   npx tsx scripts/sync-bill-counts.ts
//
// 열린국회 service ID = nzmimeepazxkubdpn ("국회의원 발의법률안")
// 키 = OPEN_ASSEMBLY_BILL_KEY
// 필수 파라미터 AGE=22 (22대 국회)
//
// 응답 RST_MONA_CD = 대표발의자. PROC_RESULT = 본회의 결과.
// 가결 판정: "원안가결" 또는 "수정가결".
// 그 외(null/"대안반영폐기"/"임기만료폐기"/"철회"/"부결" 등): 미가결.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ENDPOINT = "https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn";
const UA = "naemeosum/0.1 (https://naemeosum.com; contact: junpiano18@gmail.com)";
const AGE = "22";
const PAGE_SIZE = 1000;
const SLEEP_MS = 120;

type Row = {
  BILL_ID?: string;
  BILL_NAME?: string;
  PROC_RESULT?: string | null;
  RST_MONA_CD?: string;
};

type Response = {
  nzmimeepazxkubdpn?: Array<
    | { head: Array<{ list_total_count?: number; RESULT?: { CODE: string; MESSAGE: string } }> }
    | { row: Row[] }
  >;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(key: string, pIndex: number): Promise<{ rows: Row[]; total: number }> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("AGE", AGE);
  url.searchParams.set("pIndex", String(pIndex));
  url.searchParams.set("pSize", String(PAGE_SIZE));
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Response;
  const block = json.nzmimeepazxkubdpn ?? [];
  let total = 0;
  let rows: Row[] = [];
  for (const b of block) {
    if ("head" in b) {
      const h = b.head.find((x) => "list_total_count" in x)?.list_total_count;
      if (h) total = h;
      const result = b.head.find((x) => "RESULT" in x)?.RESULT;
      if (result && result.CODE !== "INFO-000") {
        throw new Error(`API error: ${result.CODE} ${result.MESSAGE}`);
      }
    } else if ("row" in b) {
      rows = b.row;
    }
  }
  return { rows, total };
}

function isPassed(procResult: string | null | undefined): boolean {
  if (!procResult) return false;
  return /^(원안가결|수정가결)/.test(procResult);
}

async function main() {
  const key = process.env.OPEN_ASSEMBLY_BILL_KEY;
  if (!key) {
    console.error("✗ OPEN_ASSEMBLY_BILL_KEY 비어 있음");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    // ── 1) 22대 모든 법안 다운로드 ──
    console.log("22대 발의법률안 전체 fetch...");
    const first = await fetchPage(key, 1);
    console.log(`  총 ${first.total}건`);
    const allRows: Row[] = [...first.rows];
    const pages = Math.ceil(first.total / PAGE_SIZE);
    for (let p = 2; p <= pages; p++) {
      await sleep(SLEEP_MS);
      const next = await fetchPage(key, p);
      allRows.push(...next.rows);
      process.stdout.write(`\r  page ${p}/${pages} (누적 ${allRows.length})`);
    }
    process.stdout.write("\n");
    console.log(`  fetched ${allRows.length}건`);

    // ── 2) 대표발의자별 집계 ──
    const counts = new Map<string, { proposed: number; passed: number }>();
    for (const r of allRows) {
      if (!r.RST_MONA_CD) continue;
      const c = counts.get(r.RST_MONA_CD) ?? { proposed: 0, passed: 0 };
      c.proposed++;
      if (isPassed(r.PROC_RESULT)) c.passed++;
      counts.set(r.RST_MONA_CD, c);
    }
    console.log(`  대표발의자 ${counts.size}명`);

    // ── 3) DB의 PoliticianTerm(NATIONAL_ASSEMBLY 22대)에 집계 update ──
    const terms = await prisma.politicianTerm.findMany({
      where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
      include: { politician: true },
    });

    let updated = 0;
    let zero = 0;
    for (const t of terms) {
      if (!t.politician.monaCd) continue;
      const c = counts.get(t.politician.monaCd);
      const proposed = c?.proposed ?? 0;
      const passed = c?.passed ?? 0;
      await prisma.politicianTerm.update({
        where: { id: t.id },
        data: { billProposedCount: proposed, billPassedCount: passed },
      });
      updated++;
      if (proposed === 0) zero++;
    }

    console.log(`✓ ${updated}/${terms.length} 의원 update (그중 발의 0건: ${zero}명)`);

    // 검증: 상위 5명
    const top = [...counts.entries()]
      .sort((a, b) => b[1].proposed - a[1].proposed)
      .slice(0, 5);
    console.log("\n발의 상위 5명 (monaCd):");
    for (const [monaCd, c] of top) {
      const p = terms.find((t) => t.politician.monaCd === monaCd);
      console.log(
        `  ${p?.politician.name ?? "(?)"} (${monaCd}) — 발의 ${c.proposed} · 가결 ${c.passed}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
