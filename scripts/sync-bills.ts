// 22대 대표발의 법안 전체 동기화 → Bill 테이블.
//   npx tsx scripts/sync-bills.ts
//
// 열린국회 service ID = nzmimeepazxkubdpn ("국회의원 발의법률안")
// 키 = OPEN_ASSEMBLY_BILL_KEY
//
// 응답 row 주요 필드:
//   BILL_ID, BILL_NAME, RST_MONA_CD(대표발의), PROPOSE_DT, PROC_RESULT
//
// 상태 매핑:
//   "원안가결"/"수정가결" → PASSED
//   "대안반영폐기"/"임기만료폐기"/"부결"/"폐기"/"철회" → REJECTED
//   null 또는 그 외 → PENDING

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
  PROPOSE_DT?: string | null;
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

type Status = "PENDING" | "PASSED" | "REJECTED";

function classifyStatus(procResult: string | null | undefined): Status {
  if (!procResult) return "PENDING";
  if (/^(원안가결|수정가결)/.test(procResult)) return "PASSED";
  if (/(폐기|부결|철회)/.test(procResult)) return "REJECTED";
  return "PENDING";
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // "2026-05-15" 또는 "2026-05-15 00:00:00" 형태
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
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
    // 1) 22대 모든 법안 다운로드
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

    // 2) 22대 국회의원 monaCd → Politician.id 매핑
    const terms = await prisma.politicianTerm.findMany({
      where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
      include: { politician: true },
    });
    const monaToPid = new Map<string, string>();
    for (const t of terms) {
      if (t.politician.monaCd) monaToPid.set(t.politician.monaCd, t.politician.id);
    }
    console.log(`  의원 매핑 ${monaToPid.size}명`);

    // 3) Bill 정리 & upsert. 대표발의자가 22대 의원이 아닌 케이스는 skip.
    console.log("\nBill upsert...");
    let upserted = 0;
    let skipped = 0;
    let processed = 0;
    for (const r of allRows) {
      processed++;
      if (!r.BILL_ID || !r.RST_MONA_CD) { skipped++; continue; }
      const pid = monaToPid.get(r.RST_MONA_CD);
      if (!pid) { skipped++; continue; }
      const status = classifyStatus(r.PROC_RESULT);
      const proposedAt = parseDate(r.PROPOSE_DT);
      const billUrl = `https://likms.assembly.go.kr/bill/billDetail.do?billId=${r.BILL_ID}`;
      await prisma.bill.upsert({
        where: { billId: r.BILL_ID },
        create: {
          billId: r.BILL_ID,
          politicianId: pid,
          billName: r.BILL_NAME ?? "(이름 없음)",
          billStatus: status,
          proposedAt,
          billUrl,
        },
        update: {
          // 진행 상태/처리일은 시간에 따라 바뀜
          billStatus: status,
          proposedAt,
          billName: r.BILL_NAME ?? "(이름 없음)",
        },
      });
      upserted++;
      if (processed % 500 === 0) {
        process.stdout.write(`\r  ${processed}/${allRows.length}`);
      }
    }
    process.stdout.write("\n");
    console.log(`✓ upsert ${upserted}, skip ${skipped}`);

    // 4) 검증 — 정청래·윤후덕 카운트
    for (const monaCd of ["2385336L"]) {
      const pid = monaToPid.get(monaCd);
      if (!pid) continue;
      const counts = await prisma.bill.groupBy({
        by: ["billStatus"],
        where: { politicianId: pid },
        _count: { billStatus: true },
      });
      const name = terms.find((x) => x.politician.id === pid)?.politician.name;
      console.log(`\n[${name} ${monaCd}]`);
      for (const c of counts) {
        console.log(`  ${c.billStatus}: ${c._count.billStatus}건`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
