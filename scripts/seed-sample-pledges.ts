// 공약 파이프라인 골격 시연용 가상 샘플 시드.
//   npx tsx scripts/seed-sample-pledges.ts
//
// 골격(스키마·쿼리·UI·요약 스크립트)이 실제로 동작하는지 확인하기 위한 더미 데이터.
// 실제 공약은 정식 데이터 소스(중앙선관위 등)에서 받아 일괄 교체할 것.
//
// 어느 의원에 붙는지: 첫 번째 PoliticianTerm 한 명만. 의원 이름과 분리된 일반적 키워드만 사용.
// 멱등 — 이미 시드된 동일 title은 update.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const SAMPLE_PLEDGES = [
  {
    category: "교통",
    title: "지하철 연장으로 출퇴근 시간 단축",
    originalText:
      "관내 광역 대중교통망 확충을 위해 지하철 노선 연장 및 환승 체계 개선을 추진한다. 출퇴근 시간 평균 30분 이상 단축을 목표로 한다.",
    status: "계획",
  },
  {
    category: "복지",
    title: "공공 어린이집 신설 및 운영시간 확대",
    originalText:
      "맞벌이 가구의 보육 부담을 줄이기 위해 임기 내 공공 어린이집 5개소를 신설하고 야간·휴일 운영 시간을 확대한다.",
    status: "추진중",
  },
  {
    category: "주거",
    title: "청년·신혼부부 임대주택 공급",
    originalText:
      "지역 청년 및 신혼부부의 주거 안정을 위해 시세의 70% 수준 공공임대주택을 임기 내 1,000세대 이상 공급한다.",
    status: "계획",
  },
  {
    category: "경제",
    title: "전통시장 디지털 전환 지원",
    originalText:
      "전통시장 상인을 대상으로 결제 단말기·온라인 주문 시스템 도입을 지원하고 전용 배달 플랫폼과 연계해 매출 증대를 돕는다.",
    status: "계획",
  },
  {
    category: "환경",
    title: "도심 미세먼지 측정망 확충",
    originalText:
      "관내 학교·공원·지하철역 인근에 미세먼지 간이측정기 200개를 추가 설치하고 측정값을 실시간 공개한다.",
    status: "계획",
  },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    // 표본 의원 — politician 이름순 첫 번째 22대 지역구 의원.
    const term = await prisma.politicianTerm.findFirst({
      where: {
        term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
        electedAs: "CONSTITUENCY",
      },
      include: { politician: true },
      orderBy: { politician: { name: "asc" } },
    });
    if (!term) throw new Error("22대 지역구 PoliticianTerm을 찾지 못했음. sync-assembly.ts 먼저.");
    console.log(`표본 의원: ${term.politician.name} (monaCd=${term.politician.monaCd})`);

    let inserted = 0;
    let updated = 0;
    for (const p of SAMPLE_PLEDGES) {
      const existing = await prisma.pledge.findFirst({
        where: { politicianTermId: term.id, title: p.title },
      });
      if (existing) {
        await prisma.pledge.update({
          where: { id: existing.id },
          data: { category: p.category, originalText: p.originalText, status: p.status },
        });
        updated++;
      } else {
        await prisma.pledge.create({
          data: {
            politicianTermId: term.id,
            category: p.category,
            title: p.title,
            originalText: p.originalText,
            status: p.status,
          },
        });
        inserted++;
      }
    }
    console.log(`✓ Pledge +${inserted} 신규, ~${updated} 갱신`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
