// 누락된 billId만 골라 VoteRecord 채우기.
// PlenaryBill.voteTcnt > 0 인데 VoteRecord에 row 0개인 billId만 타겟.
//
//   npx tsx scripts/sync-votes-missing.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const VOTE_ENDPOINT = "https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi";
const SLEEP_MS = 200;

type Row = {
  MONA_CD?: string;
  VOTE_DATE?: string;
  BILL_NO?: string;
  BILL_NAME?: string;
  BILL_ID?: string;
  BILL_URL?: string;
  RESULT_VOTE_MOD?: string;
  SESSION_CD?: number | string;
  CURRENTS_CD?: number | string;
  AGE?: number | string;
};

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function parseVoteDate(s: string | undefined): Date | null {
  if (!s) return null;
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
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 naemeosum/0.1" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  if ("RESULT" in json) {
    const r = json.RESULT as { CODE?: string; MESSAGE?: string };
    if (r.CODE === "INFO-200") return [];
    throw new Error(`${r.CODE} ${r.MESSAGE}`);
  }
  const blocks = (json.nojepdqqaweusdfbi ?? []) as Array<{ row?: Row[] }>;
  for (const b of blocks) if (b.row) return b.row;
  return [];
}

async function main() {
  const key = process.env.OPEN_ASSEMBLY_API_KEY;
  if (!key) { console.error("✗ OPEN_ASSEMBLY_API_KEY 비어 있음"); process.exit(1); }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const missing: Array<{ billId: string; billName: string; voteTcnt: number }> =
      await prisma.$queryRaw`
        SELECT pb."billId", pb."billName", pb."voteTcnt"
        FROM "PlenaryBill" pb
        WHERE pb."voteTcnt" > 0
          AND NOT EXISTS (SELECT 1 FROM "VoteRecord" vr WHERE vr."billId" = pb."billId")
        ORDER BY pb."procDate" DESC NULLS LAST
      `;
    console.log(`누락 의안 ${missing.length}건`);
    if (!missing.length) { console.log("✓ 누락 없음"); return; }

    const pols = await prisma.politician.findMany({
      where: { monaCd: { not: null } },
      select: { id: true, monaCd: true },
    });
    const polByMona = new Map(pols.filter((p) => p.monaCd).map((p) => [p.monaCd!, p.id]));

    let total = 0, skipped = 0;
    for (const b of missing) {
      let rows: Row[];
      try {
        rows = await fetchVotesForBill(key, b.billId);
      } catch (e) {
        console.error(`  ✗ ${b.billId} ${(e as Error).message}`);
        await sleep(SLEEP_MS);
        continue;
      }
      let cnt = 0;
      for (const r of rows) {
        const polId = r.MONA_CD ? polByMona.get(r.MONA_CD) : null;
        if (!polId) { skipped++; continue; }
        const result = mapResult(r.RESULT_VOTE_MOD);
        const voteDate = parseVoteDate(r.VOTE_DATE);
        if (!result || !voteDate) { skipped++; continue; }
        await prisma.voteRecord.upsert({
          where: { politicianId_billId: { politicianId: polId, billId: b.billId } },
          create: {
            politicianId: polId,
            billId: b.billId,
            billName: r.BILL_NAME ?? b.billName,
            voteDate,
            result,
            billUrl: r.BILL_URL ?? null,
            sessionCd: r.SESSION_CD !== undefined ? Number(r.SESSION_CD) : null,
            currentsCd: r.CURRENTS_CD !== undefined ? Number(r.CURRENTS_CD) : null,
            age: r.AGE !== undefined ? Number(r.AGE) : 22,
          },
          update: { billName: r.BILL_NAME ?? b.billName, voteDate, result, billUrl: r.BILL_URL ?? null },
        });
        cnt++;
        total++;
      }
      console.log(`  ✓ ${b.billId.slice(0, 14)}… ${b.billName.slice(0, 40)} (${rows.length} rows → ${cnt} upserts)`);
      await sleep(SLEEP_MS);
    }
    console.log(`\n✓ 완료: ${total}건 upsert${skipped ? ` (skip ${skipped})` : ""}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
