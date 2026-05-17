// 일회성 검증 스크립트.
//   npx tsx scripts/test-assembly-api.ts
//
// open-assembly.ts 클라이언트가 실제 API에서 22대 의원 명단을 잘 받아오는지 확인.

import "dotenv/config";
import { fetchCurrentAssemblyMembers } from "../src/lib/sources/open-assembly";

async function main() {
  const { rows, totalCount } = await fetchCurrentAssemblyMembers(1, 5);
  console.log(`총 의원 수: ${totalCount}명`);
  console.log(`첫 페이지(5명) 샘플:`);
  for (const m of rows) {
    console.log(
      `  - ${m.HG_NM} (${m.POLY_NM}) · ${m.ORIG_NM} [${m.ELECT_GBN_NM}] · MONA_CD=${m.MONA_CD}`,
    );
  }

  // 분포 통계도 한 번 — 지역구/비례대표 비율
  const { rows: all } = await fetchCurrentAssemblyMembers(1, 300);
  const byType = new Map<string, number>();
  const byParty = new Map<string, number>();
  for (const m of all) {
    byType.set(m.ELECT_GBN_NM ?? "(미상)", (byType.get(m.ELECT_GBN_NM ?? "(미상)") ?? 0) + 1);
    byParty.set(m.POLY_NM ?? "(무소속)", (byParty.get(m.POLY_NM ?? "(무소속)") ?? 0) + 1);
  }
  console.log("\n선출 구분:");
  for (const [k, v] of byType) console.log(`  ${k}: ${v}`);
  console.log("\n정당별:");
  for (const [k, v] of [...byParty.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
