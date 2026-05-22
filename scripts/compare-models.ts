// 같은 법안 1건을 Sonnet 4.6 vs Haiku 4.5로 요약해 품질·비용을 나란히 비교.
// DB는 건드리지 않는다. summary 이미 채워진 법안이 있으면 그걸 기준으로 비교.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { summarizeBill } from "../src/lib/ai/bill-summary";

const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

const PRICING: Record<string, { in: number; out: number }> = {
  [SONNET]: { in: 3, out: 15 },
  [HAIKU]: { in: 1, out: 5 },
};

function cost(model: string, inTok: number, outTok: number): number {
  const p = PRICING[model];
  return (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ ANTHROPIC_API_KEY 비어 있음");
    process.exit(1);
  }
  const targetName = process.argv[2] ?? "정청래";

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const bill = await prisma.bill.findFirst({
      where: { politician: { name: targetName } },
      orderBy: { proposedAt: "desc" },
      include: { politician: true },
    });
    if (!bill) {
      console.error(`✗ ${targetName} 의원의 법안을 찾을 수 없음`);
      return;
    }
    console.log(`법안: ${bill.billName}  (의원: ${bill.politician.name})\n`);

    // 1) Sonnet (이미 채워진 summary 있으면 캐시처럼 활용, 없으면 호출)
    let sonnetSummary: string;
    let sonnetUsage = { inputTokens: 0, outputTokens: 0 };
    let sonnetFromDb = false;
    if (bill.summary) {
      sonnetSummary = bill.summary;
      sonnetFromDb = true;
    } else {
      const r = await summarizeBill(bill.billName, SONNET);
      sonnetSummary = r.summary;
      sonnetUsage = r.usage;
    }

    // 2) Haiku (항상 호출)
    const haikuR = await summarizeBill(bill.billName, HAIKU);

    console.log("─── Sonnet 4.6 " + (sonnetFromDb ? "(DB 캐시) " : "") + "───");
    console.log(sonnetSummary);
    if (!sonnetFromDb) {
      console.log(
        `  토큰: in ${sonnetUsage.inputTokens} / out ${sonnetUsage.outputTokens}` +
          ` · 비용: $${cost(SONNET, sonnetUsage.inputTokens, sonnetUsage.outputTokens).toFixed(6)}`,
      );
    }
    console.log("\n─── Haiku 4.5 ───");
    console.log(haikuR.summary);
    console.log(
      `  토큰: in ${haikuR.usage.inputTokens} / out ${haikuR.usage.outputTokens}` +
        ` · 비용: $${cost(HAIKU, haikuR.usage.inputTokens, haikuR.usage.outputTokens).toFixed(6)}`,
    );

    if (!sonnetFromDb) {
      const sCost = cost(SONNET, sonnetUsage.inputTokens, sonnetUsage.outputTokens);
      const hCost = cost(HAIKU, haikuR.usage.inputTokens, haikuR.usage.outputTokens);
      const ratio = hCost > 0 ? sCost / hCost : 0;
      console.log(`\n→ Sonnet이 Haiku보다 약 ${ratio.toFixed(1)}배 비쌈`);
    } else {
      // Sonnet usage 모르니 16,060건 환산만 Haiku 기준으로
      const hCostPer = cost(HAIKU, haikuR.usage.inputTokens, haikuR.usage.outputTokens);
      console.log(`\n→ Haiku로 전체 16,060건 환산 시 ~$${(hCostPer * 16060).toFixed(2)}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
