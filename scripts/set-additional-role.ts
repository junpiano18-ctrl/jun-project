import "dotenv/config";
import { prisma } from "../src/lib/db";

// 본 직무 외 겸직(장관 등) 데이터를 수동으로 채우는 스크립트.
// PoliticianTerm 단위로 update — 의원·임기 매칭 후 set.
//
// 사용:
//   npx tsx scripts/set-additional-role.ts
//
// 새 케이스 추가 시 ENTRIES 배열에 한 줄 더 넣으면 됨. 재실행 안전(idempotent).

type Entry = {
  politicianName: string;
  districtName: string; // PoliticianTerm.district.name (예: "경기 동두천양주연천갑")
  termPositionType:
    | "NATIONAL_ASSEMBLY"
    | "METRO_GOVERNOR"
    | "LOCAL_GOVERNOR"
    | "EDUCATION_SUPERINTENDENT";
  termNumber: number;
  additionalRole: string;
  additionalRoleStartDate: string; // ISO date
  additionalRoleSource: string;
};

const ENTRIES: Entry[] = [
  {
    politicianName: "정성호",
    districtName: "경기 동두천시양주시연천군갑",
    termPositionType: "NATIONAL_ASSEMBLY",
    termNumber: 22,
    additionalRole: "법무부장관",
    additionalRoleStartDate: "2025-07-21",
    additionalRoleSource: "법무부 공식 발표",
  },
];

async function main() {
  let ok = 0;
  let skipped = 0;
  for (const e of ENTRIES) {
    const term = await prisma.politicianTerm.findFirst({
      where: {
        politician: { name: e.politicianName },
        district: { name: e.districtName, positionType: e.termPositionType },
        term: { positionType: e.termPositionType, number: e.termNumber },
      },
      include: { politician: true, district: true, term: true },
    });
    if (!term) {
      console.warn(
        `  ✗ 매칭 실패: ${e.politicianName} / ${e.districtName} / ${e.termPositionType} ${e.termNumber}대`,
      );
      skipped++;
      continue;
    }

    await prisma.politicianTerm.update({
      where: { id: term.id },
      data: {
        additionalRole: e.additionalRole,
        additionalRoleStartDate: new Date(e.additionalRoleStartDate),
        additionalRoleSource: e.additionalRoleSource,
      },
    });
    console.log(
      `  ✓ ${term.politician.name} (${term.district.name}) → ${e.additionalRole} (${e.additionalRoleStartDate})`,
    );
    ok++;
  }
  console.log(`\n총 ${ok}건 적용, ${skipped}건 스킵.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
