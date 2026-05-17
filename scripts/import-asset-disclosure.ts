// 정보공개센터 2025 국회의원 재산공개 데이터를 import.
//   npx tsx scripts/import-asset-disclosure.ts
//
// 출처: 정보공개센터 구글 시트 (2025년 3월 27일 국회공보 PDF를 정제한 데이터)
// 단위: 천원 (시트 그대로)
// 매칭: Politician.name. 동명이인은 경고 후 skip.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const SHEET_ID = "182m4MFFj4Ho2cICo3PGy8RyxHZ3vwNklyo5yM4M5M4Q";
const GID_TOTAL = 1237345243; // 의원별 총액 시트
const GID_BREAKDOWN = 1348326949; // 재산구분별(토지/건물/예금/주식 등)
const YEAR = 2025;
const SOURCE = "정보공개센터 / 국회공보 2025년 3월 27일자";

async function fetchCsv(gid: number): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed gid=${gid}: ${res.status}`);
  const text = await res.text();
  return text.split(/\r?\n/).filter((l) => l.length > 0).map(parseCsvLine);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

// "2,551,815" → 2551815 (천원). 빈 값 또는 "-" → null
function parseAmount(s: string): bigint | null {
  if (!s) return null;
  const trimmed = s.trim().replace(/,/g, "").replace(/\s/g, "");
  if (!trimmed || trimmed === "-") return null;
  const n = Number(trimmed);
  if (isNaN(n)) return null;
  return BigInt(n);
}

// "1.  국회의원"의 첫 토큰 1만 인정 (다른 직급 시트엔 다른 토큰)
function isNationalAssembly(gubun: string): boolean {
  return /국회의원/.test(gubun);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    console.log("총액 시트 fetch...");
    const totalRows = await fetchCsv(GID_TOTAL);
    console.log(`  ${totalRows.length}행`);

    console.log("재산구분별 시트 fetch...");
    const breakdownRows = await fetchCsv(GID_BREAKDOWN);
    console.log(`  ${breakdownRows.length}행`);

    // 헤더: No,구분,소속,직위,성명,종전가액,증가액,감소액,현재가액,증감액,가액변동
    // 인덱스:  0   1   2    3    4      5       6      7     8       9      10
    const totalByName = new Map<
      string,
      { total: bigint | null; change: bigint | null }
    >();
    for (const row of totalRows.slice(1)) {
      if (row.length < 10) continue;
      if (!isNationalAssembly(row[1])) continue;
      const name = row[4]?.trim();
      if (!name) continue;
      totalByName.set(name, {
        total: parseAmount(row[8]),
        change: parseAmount(row[9]),
      });
    }
    console.log(`  국회의원 총액 ${totalByName.size}명`);

    // 헤더: No,구분,소속,직위,성명,재산구분,종전가액,증가액,감소액,현재가액
    // 인덱스:  0   1   2    3    4     5         6       7      8     9
    const breakdownByName = new Map<
      string,
      { land?: bigint; building?: bigint; deposit?: bigint; stock?: bigint }
    >();
    for (const row of breakdownRows.slice(1)) {
      if (row.length < 10) continue;
      if (!isNationalAssembly(row[1])) continue;
      const name = row[4]?.trim();
      if (!name) continue;
      const category = row[5]?.trim();
      const current = parseAmount(row[9]);
      if (!current) continue;
      const e = breakdownByName.get(name) ?? {};
      if (/토지/.test(category)) e.land = current;
      else if (/건물/.test(category)) e.building = current;
      else if (/예금/.test(category)) e.deposit = current;
      else if (/주식|증권/.test(category)) e.stock = current;
      breakdownByName.set(name, e);
    }
    console.log(`  국회의원 재산구분별 ${breakdownByName.size}명`);

    // DB 매칭
    console.log("\nDB 매칭 + insert/update...");
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const ambiguous: string[] = [];

    for (const [name, totals] of totalByName) {
      const ps = await prisma.politician.findMany({
        where: {
          name,
          terms: { some: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } } },
        },
      });
      if (ps.length === 0) { skipped++; continue; }
      if (ps.length > 1) {
        ambiguous.push(name);
        continue;
      }
      const p = ps[0];
      const bd = breakdownByName.get(name) ?? {};
      const total = totals.total;
      if (total === null) { skipped++; continue; }

      const existing = await prisma.asset.findUnique({
        where: { politicianId_year: { politicianId: p.id, year: YEAR } },
      });
      const data = {
        totalKrw: total,
        changeKrw: totals.change,
        landKrw: bd.land ?? null,
        buildingKrw: bd.building ?? null,
        depositKrw: bd.deposit ?? null,
        stockKrw: bd.stock ?? null,
        source: SOURCE,
        disclosedAt: new Date("2025-03-27"),
      };
      if (existing) {
        await prisma.asset.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.asset.create({
          data: { ...data, politicianId: p.id, year: YEAR },
        });
        inserted++;
      }
    }

    console.log(`✓ insert ${inserted} · update ${updated} · skip ${skipped}`);
    if (ambiguous.length) {
      console.log(`⚠ 동명이인 (skip): ${ambiguous.join(", ")}`);
    }

    // 미매칭 (시트엔 있는데 DB에 없는) 의원 출력
    const matched = inserted + updated;
    const unmatchedCount = totalByName.size - matched - ambiguous.length;
    if (unmatchedCount > 0) {
      console.log(`⚠ DB에 없는 의원 ${unmatchedCount}명 (시트엔 있음)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
