import "dotenv/config";
import { prisma } from "../src/lib/db";

// 법원 판결 정보를 수동으로 채우는 스크립트.
// 표시 정책: 1심 이상 판결만. 수사·기소 단계는 절대 채우지 말 것.
// "확정 판결로 의원직 상실"의 경우 dismissed=true 로 표시하면
// PoliticianTerm.status 도 DISMISSED 로 함께 set — 카드의 빨간 배지가 자동으로 뜸.
//
// 사용:
//   npx tsx scripts/set-court-ruling.ts
//
// 새 케이스 추가 시 ENTRIES 배열에 한 줄 더 넣고 재실행. idempotent.

type Entry = {
  politicianName: string;
  districtName: string;
  termPositionType:
    | "NATIONAL_ASSEMBLY"
    | "METRO_GOVERNOR"
    | "LOCAL_GOVERNOR"
    | "EDUCATION_SUPERINTENDENT";
  termNumber: number;
  rulingDate: string; // ISO date
  rulingSummary: string; // 예: "1심 징역 2년 선고"
  rulingFinal: boolean; // 확정 판결 여부
  rulingSource: string;
  // 확정 판결로 의원직 상실 효과까지 발생한 경우 true.
  // status 가 DISMISSED 로 함께 갱신되어 카드 빨간 배지가 뜸.
  dismissed: boolean;
};

const ENTRIES: Entry[] = [
  // 정확한 판결문/출처 확인 후 추가할 것. 예시:
  // {
  //   politicianName: "권성동",
  //   districtName: "강원 강릉시",
  //   termPositionType: "NATIONAL_ASSEMBLY",
  //   termNumber: 22,
  //   rulingDate: "2026-01-28",
  //   rulingSummary: "1심 징역 2년 선고",
  //   rulingFinal: false,
  //   rulingSource: "법원 판결 (공개 정보)",
  //   dismissed: false,
  // },
];

async function main() {
  if (ENTRIES.length === 0) {
    console.log(
      "ENTRIES 배열이 비어있습니다. 정확한 판결 정보 확인 후 채워서 재실행하세요.",
    );
    await prisma.$disconnect();
    return;
  }
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
        courtRulingDate: new Date(e.rulingDate),
        courtRulingSummary: e.rulingSummary,
        courtRulingFinal: e.rulingFinal,
        courtRulingSource: e.rulingSource,
        ...(e.dismissed ? { status: "DISMISSED" as const } : {}),
      },
    });
    console.log(
      `  ✓ ${term.politician.name} (${term.district.name}) → ${e.rulingSummary} (${e.rulingDate})${
        e.dismissed ? " · status=DISMISSED" : ""
      }`,
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
