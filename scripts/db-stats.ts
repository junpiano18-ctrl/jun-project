import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
  const prisma = new PrismaClient({ adapter });

  const [parties, terms, politicians, politicianTerms, districts] = await Promise.all([
    prisma.party.count(),
    prisma.term.count(),
    prisma.politician.count(),
    prisma.politicianTerm.count(),
    prisma.district.count(),
  ]);

  console.log("─ DB row counts ─");
  console.log(`Party           : ${parties}`);
  console.log(`Term            : ${terms}`);
  console.log(`Politician      : ${politicians}`);
  console.log(`PoliticianTerm  : ${politicianTerms}`);
  console.log(`District        : ${districts}`);

  const byParty = await prisma.politicianTerm.groupBy({
    by: ["partyId"],
    _count: { _all: true },
  });
  const partyNames = new Map((await prisma.party.findMany()).map((p) => [p.id, p.name]));
  console.log("\n─ 정당별 의석 ─");
  for (const r of byParty.sort((a, b) => b._count._all - a._count._all)) {
    const name = r.partyId ? partyNames.get(r.partyId) ?? "(매핑실패)" : "(null)";
    console.log(`  ${name}: ${r._count._all}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
