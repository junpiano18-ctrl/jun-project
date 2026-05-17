// 기준 데이터 시드.
// prisma.config.ts에서 `migrations.seed = "tsx prisma/seed.ts"`로 호출된다.
// 멱등 — 여러 번 돌려도 같은 결과.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// 색은 각 당 공식/관례 색. 22대 기준.
const PARTIES = [
  { name: "더불어민주당", shortName: "민주당", color: "#004EA2" },
  { name: "국민의힘", shortName: "국힘", color: "#E61E2B" },
  { name: "조국혁신당", shortName: "조국혁신당", color: "#06275E" },
  { name: "진보당", shortName: "진보당", color: "#D6001C" },
  { name: "개혁신당", shortName: "개혁신당", color: "#FF7920" },
  { name: "기본소득당", shortName: "기본", color: "#00D2C3" },
  { name: "사회민주당", shortName: "사민당", color: "#F58400" },
  { name: "무소속", shortName: "무소속", color: "#888888" },
];

async function main() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error("DIRECT_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const p of PARTIES) {
      await prisma.party.upsert({
        where: { name: p.name },
        update: { shortName: p.shortName, color: p.color },
        create: p,
      });
    }
    console.log(`✓ ${PARTIES.length} parties`);

    // 22대 국회 임기: 2024-05-30 ~ 2028-05-29
    await prisma.term.upsert({
      where: { positionType_number: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
      update: {},
      create: {
        positionType: "NATIONAL_ASSEMBLY",
        number: 22,
        startDate: new Date("2024-05-30"),
        endDate: new Date("2028-05-29"),
      },
    });
    console.log("✓ Term 22 (NATIONAL_ASSEMBLY)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
