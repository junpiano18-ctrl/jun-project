// 22대 의원의 주요 경력(MEM_TITLE) 동기화 → Politician.careerText.
//   npx tsx scripts/sync-career-text.ts
//
// 열린국회 service ID = nwvrqwxyaytdsfvhu ("국회의원 현황")
// 키 = OPEN_ASSEMBLY_API_KEY
//
// 응답 MEM_TITLE은 학력+경력 통합 멀티라인 텍스트. HTML entities(&middot; 등) 포함 →
// 표시 단계에서 decode/정리.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ENDPOINT = "https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu";
const UA = "naemeosum/0.1 (https://naemeosum.com; contact: junpiano18@gmail.com)";

type Row = {
  HG_NM?: string;
  MONA_CD?: string;
  MEM_TITLE?: string;
};

async function fetchAll(key: string): Promise<Row[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "1000");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    nwvrqwxyaytdsfvhu?: Array<
      | { head: Array<{ list_total_count?: number; RESULT?: { CODE: string; MESSAGE: string } }> }
      | { row: Row[] }
    >;
  };
  const block = json.nwvrqwxyaytdsfvhu ?? [];
  for (const b of block) {
    if ("row" in b) return b.row;
  }
  return [];
}

async function main() {
  const key = process.env.OPEN_ASSEMBLY_API_KEY;
  if (!key) { console.error("✗ OPEN_ASSEMBLY_API_KEY 비어 있음"); process.exit(1); }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    console.log("의원 정보 fetch...");
    const rows = await fetchAll(key);
    console.log(`  ${rows.length}건`);

    let updated = 0;
    for (const r of rows) {
      if (!r.MONA_CD) continue;
      const text = (r.MEM_TITLE ?? "").trim();
      if (!text) continue;
      await prisma.politician.updateMany({
        where: { monaCd: r.MONA_CD },
        data: { careerText: text },
      });
      updated++;
    }
    console.log(`✓ careerText update ${updated}건`);

    // 정청래 검증
    const jcr = await prisma.politician.findUnique({ where: { monaCd: "2385336L" } });
    if (jcr?.careerText) {
      console.log("\n[정청래 careerText, 첫 300자]");
      console.log(jcr.careerText.slice(0, 300));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
