// 정청래 의원 법안 5건 모두 Sonnet(DB 캐시) vs Haiku 비교 출력.
// DB는 건드리지 않음.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { summarizeBill } from "../src/lib/ai/bill-summary";

const HAIKU = "claude-haiku-4-5-20251001";
const HAIKU_PRICE = { in: 1, out: 5 }; // $/MTok
const SONNET_PRICE = { in: 3, out: 15 };

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });
  try {
    const bills = await prisma.bill.findMany({
      where: { politician: { name: "정청래" } },
      orderBy: { proposedAt: "desc" },
      take: 5,
      include: { politician: true },
    });

    let hIn = 0, hOut = 0;
    for (const b of bills) {
      console.log(`\n=== ${b.billName} ===`);
      console.log("[Sonnet 4.6 (DB)]");
      console.log(b.summary ?? "(없음)");
      const r = await summarizeBill(b.billName, HAIKU);
      console.log("\n[Haiku 4.5]");
      console.log(r.summary);
      console.log(`  토큰: in ${r.usage.inputTokens} / out ${r.usage.outputTokens}`);
      hIn += r.usage.inputTokens;
      hOut += r.usage.outputTokens;
      await new Promise((r) => setTimeout(r, 250));
    }

    const haikuCost = (hIn / 1_000_000) * HAIKU_PRICE.in + (hOut / 1_000_000) * HAIKU_PRICE.out;
    const haikuPerBill = haikuCost / bills.length;
    const sonnetPerBill = 0.00214; // Sonnet 803건 실측 평균

    console.log("\n────────────────────────────────────");
    console.log(`Haiku 5건 합계: input ${hIn} / output ${hOut} = $${haikuCost.toFixed(5)}`);
    console.log(`Haiku 호출당: $${haikuPerBill.toFixed(5)}`);
    console.log(`Sonnet 호출당 (803건 실측): $${sonnetPerBill}`);
    console.log(`Haiku가 Sonnet보다 약 ${(sonnetPerBill / haikuPerBill).toFixed(1)}배 저렴`);
    console.log(`나머지 15,257건 환산 — Sonnet: ~$${(sonnetPerBill * 15257).toFixed(2)} · Haiku: ~$${(haikuPerBill * 15257).toFixed(2)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
