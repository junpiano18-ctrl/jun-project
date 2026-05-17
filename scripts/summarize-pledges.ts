// 쉬운말 요약(easySummary)이 비어 있는 Pledge에 Claude API를 호출해 요약을 채운다.
//   npx tsx scripts/summarize-pledges.ts
//
// ANTHROPIC_API_KEY가 없으면 안내만 출력하고 종료.
// 멱등 — 이미 easySummary가 있으면 건너뛴다. 요약 갱신은 별도 플래그로(추후 추가).
// 호출 간 200ms 대기로 rate limit 여유.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { summarizePledge } from "../src/lib/ai/pledge-summary";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ ANTHROPIC_API_KEY가 비어 있습니다.");
    console.error("  console.anthropic.com에서 키 발급 후 .env에 채우고 다시 실행하세요.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const pending = await prisma.pledge.findMany({
      where: { easySummary: null },
      orderBy: { politicianTermId: "asc" },
    });
    console.log(`요약 대상 Pledge ${pending.length}건`);
    if (pending.length === 0) return;

    let done = 0;
    let failed = 0;
    for (const p of pending) {
      try {
        const { summary, model } = await summarizePledge(p.originalText);
        await prisma.pledge.update({
          where: { id: p.id },
          data: {
            easySummary: summary,
            summaryModel: model,
            summaryUpdatedAt: new Date(),
          },
        });
        done++;
        process.stdout.write(`\r  요약 ${done}/${pending.length}`);
        await sleep(200);
      } catch (e) {
        failed++;
        console.error(`\n  ✗ Pledge ${p.id} 실패:`, (e as Error).message);
      }
    }
    process.stdout.write("\n");
    console.log(`✓ ${done}/${pending.length} 요약 완료${failed ? ` (실패 ${failed})` : ""}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
