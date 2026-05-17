import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  // 1) 정청래 단건
  const p = await prisma.politician.findFirst({
    where: { monaCd: "2385336L" },
    include: { terms: true, assets: { orderBy: { year: "desc" }, take: 1 } },
  });
  const t = p?.terms[0];
  console.log("[정청래]");
  console.log("  attendanceRate          :", t?.attendanceRate);
  console.log("  plenaryVoteAttendCount  :", t?.plenaryVoteAttendCount);
  console.log("  plenaryVoteSessionCount :", t?.plenaryVoteSessionCount);
  console.log("  billProposedCount       :", t?.billProposedCount);
  console.log("  billPassedCount         :", t?.billPassedCount);
  console.log("  committees (count)      :", Array.isArray(t?.committees) ? (t?.committees as unknown[]).length : "—");
  console.log("  asset totalKrw          :", p?.assets[0]?.totalKrw?.toString());

  // 2) 22대 전체 통계
  const all = await prisma.politicianTerm.findMany({
    where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
    select: {
      attendanceRate: true,
      plenaryVoteAttendCount: true,
      plenaryVoteSessionCount: true,
      billProposedCount: true,
      billPassedCount: true,
      committees: true,
    },
  });
  const tot = all.length;
  const nn = (k: keyof (typeof all)[number]) =>
    all.filter((r) => r[k] !== null && r[k] !== undefined).length;
  console.log("\n[22대 286명 컬럼 채워진 수]");
  console.log(`  attendanceRate          : ${nn("attendanceRate")}/${tot}`);
  console.log(`  plenaryVoteAttendCount  : ${nn("plenaryVoteAttendCount")}/${tot}`);
  console.log(`  plenaryVoteSessionCount : ${nn("plenaryVoteSessionCount")}/${tot}`);
  console.log(`  billProposedCount       : ${nn("billProposedCount")}/${tot}`);
  console.log(`  billPassedCount         : ${nn("billPassedCount")}/${tot}`);
  console.log(
    `  committees (non-empty)  : ${all.filter((r) => Array.isArray(r.committees) && (r.committees as unknown[]).length > 0).length}/${tot}`,
  );

  await prisma.$disconnect();
}
main();
