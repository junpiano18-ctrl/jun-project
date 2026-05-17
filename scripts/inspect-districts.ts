// District.name의 첫 토큰(공백 이전)이 시도 단축명으로 일관되는지 확인.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
  const prisma = new PrismaClient({ adapter });

  const districts = await prisma.district.findMany({
    where: { positionType: "NATIONAL_ASSEMBLY" },
    orderBy: { name: "asc" },
  });

  const tokens = new Map<string, number>();
  for (const d of districts) {
    const first = d.isProportional ? "(비례대표)" : d.name.split(/\s+/)[0];
    tokens.set(first, (tokens.get(first) ?? 0) + 1);
  }

  console.log(`총 District: ${districts.length}\n첫 토큰 분포:`);
  for (const [k, v] of [...tokens.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  // 시도 단축명 후보가 아닌(=2글자/3글자가 아닌) 첫 토큰이 있는지 별도 출력
  const weird = districts
    .filter((d) => !d.isProportional)
    .filter((d) => {
      const t = d.name.split(/\s+/)[0];
      return t.length < 2 || t.length > 4;
    });
  if (weird.length) {
    console.log("\n예외 후보(이름이 분리되지 않는 District):");
    for (const d of weird) console.log(`  - ${d.name}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
