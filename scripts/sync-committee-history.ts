// 22대 국회의원 위원회 경력 동기화.
//   npx tsx scripts/sync-committee-history.ts
//
// 열린국회 service ID = nyzrglyvagmrypezq ("국회의원 위원회 경력")
// 키 = OPEN_ASSEMBLY_CAREER_KEY
//
// 응답 row:
//   HG_NM, HJ_NM, MONA_CD
//   PROFILE_SJ      "제22대 국방위원회"
//   FRTO_DATE       "2025.06.30 ~ " 또는 "2024.06.10 ~ 2025.06.30"
//   PROFILE_UNIT_CD "100022" 22대
//
// 22대(PROFILE_UNIT_CD == 100022) 행만 의원별로 모아
// PoliticianTerm.committees = [{name, start, end}] (최신순)에 저장.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ENDPOINT = "https://open.assembly.go.kr/portal/openapi/nyzrglyvagmrypezq";
const UA = "naemeosum/0.1 (https://naemeosum.com; contact: junpiano18@gmail.com)";
const PAGE_SIZE = 1000;
const SLEEP_MS = 120;
const UNIT_22 = "100022";

type Row = {
  HG_NM?: string;
  MONA_CD?: string;
  PROFILE_SJ?: string;
  FRTO_DATE?: string;
  PROFILE_UNIT_CD?: string;
};

type Response = {
  nyzrglyvagmrypezq?: Array<
    | { head: Array<{ list_total_count?: number; RESULT?: { CODE: string; MESSAGE: string } }> }
    | { row: Row[] }
  >;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(key: string, pIndex: number): Promise<{ rows: Row[]; total: number }> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", String(pIndex));
  url.searchParams.set("pSize", String(PAGE_SIZE));
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Response;
  const block = json.nyzrglyvagmrypezq ?? [];
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

// "제22대 국방위원회" → "국방위원회"
function stripPrefix(profileSj: string | undefined): string {
  if (!profileSj) return "";
  return profileSj.replace(/^제\d+대\s*/, "").trim();
}

// "2025.06.30 ~ " → { start: "2025-06-30", end: null }
// "2024.06.10 ~ 2025.06.30" → { start: "2024-06-10", end: "2025-06-30" }
function parseDate(s: string | undefined): { start: string | null; end: string | null } {
  if (!s) return { start: null, end: null };
  const parts = s.split("~").map((x) => x.trim());
  const toIso = (d: string): string | null => {
    if (!d) return null;
    const m = d.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  };
  return { start: toIso(parts[0] ?? ""), end: toIso(parts[1] ?? "") };
}

async function main() {
  const key = process.env.OPEN_ASSEMBLY_CAREER_KEY;
  if (!key) {
    console.error("✗ OPEN_ASSEMBLY_CAREER_KEY 비어 있음");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    console.log("위원회 경력 전체 fetch...");
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

    // 22대만, MONA_CD별 그룹
    const byMona = new Map<string, Array<{ name: string; start: string | null; end: string | null }>>();
    for (const r of allRows) {
      if (r.PROFILE_UNIT_CD !== UNIT_22) continue;
      if (!r.MONA_CD) continue;
      const name = stripPrefix(r.PROFILE_SJ);
      if (!name) continue;
      const dates = parseDate(r.FRTO_DATE);
      const arr = byMona.get(r.MONA_CD) ?? [];
      arr.push({ name, start: dates.start, end: dates.end });
      byMona.set(r.MONA_CD, arr);
    }
    console.log(`  22대 위원회 데이터 있는 의원 ${byMona.size}명`);

    // 최신순 정렬 (start desc, null = 진행중이라 최상위)
    for (const [, arr] of byMona) {
      arr.sort((a, b) => {
        const aStart = a.start ?? "9999";
        const bStart = b.start ?? "9999";
        return bStart.localeCompare(aStart);
      });
    }

    const terms = await prisma.politicianTerm.findMany({
      where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
      include: { politician: true },
    });

    let updated = 0;
    let empty = 0;
    for (const t of terms) {
      if (!t.politician.monaCd) continue;
      const arr = byMona.get(t.politician.monaCd) ?? [];
      await prisma.politicianTerm.update({
        where: { id: t.id },
        data: { committees: arr },
      });
      updated++;
      if (arr.length === 0) empty++;
    }
    console.log(`✓ ${updated}/${terms.length} 의원 update (그중 빈 데이터: ${empty}명)`);

    // 검증: 정청래 + 임의 3명
    const sample = terms.filter((t) =>
      ["2385336L"].includes(t.politician.monaCd ?? ""),
    );
    for (const t of sample) {
      console.log(`\n[${t.politician.name}] ${t.politician.monaCd}`);
      const arr = byMona.get(t.politician.monaCd!) ?? [];
      for (const c of arr) console.log(`  ${c.start ?? "?"} ~ ${c.end ?? "현재"} :: ${c.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
