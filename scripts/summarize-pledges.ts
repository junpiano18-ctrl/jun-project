// 쉬운말 요약(easySummary)이 비어 있는 Pledge에 Claude API를 호출해 요약을 채운다.
//   npx tsx scripts/summarize-pledges.ts [--concurrency=N]
//
// ANTHROPIC_API_KEY가 없으면 안내만 출력하고 종료.
// 멱등 — 이미 easySummary가 있으면 건너뛴다. 요약 갱신은 별도 플래그로(추후 추가).
// concurrency: 동시 진행 갯수. 기본 4. prompt cache(5분 TTL)는 빠른 연속 호출일수록 hit율↑.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { summarizePledge } from "../src/lib/ai/pledge-summary";

// 단순 async pool — 동시 처리 갯수 N개를 유지하며 작업을 소진.
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  let nextIdx = 0;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (true) {
          const idx = nextIdx++;
          if (idx >= items.length) return;
          await worker(items[idx], idx);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ ANTHROPIC_API_KEY가 비어 있습니다.");
    console.error("  console.anthropic.com에서 키 발급 후 .env에 채우고 다시 실행하세요.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  // Anthropic free/낮은 tier 한도: 50 RPM + 10k OPM/min.
  // concurrency=2 + max_tokens=250 = ~36 RPM, ~9k OPM/min — 두 한도 모두 여유.
  const concurrency = Number(args.find((a) => a.startsWith("--concurrency="))?.slice(14) ?? "2");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const pending = await prisma.pledge.findMany({
      where: { easySummary: null },
      orderBy: { politicianTermId: "asc" },
      select: { id: true, originalText: true },
    });
    console.log(`요약 대상 Pledge ${pending.length}건 (concurrency=${concurrency})`);
    if (pending.length === 0) return;

    let done = 0;
    let failed = 0;
    const startedAt = Date.now();

    await runPool(pending, concurrency, async (p) => {
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
        // 50건마다 한 줄로 진행 — Monitor가 잡기 쉬운 stable 포맷.
        if (done % 50 === 0 || done === pending.length) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          console.log(`progress ${done}/${pending.length} (${elapsed}s)`);
        }
      } catch (e) {
        failed++;
        console.error(`✗ Pledge ${p.id} 실패: ${(e as Error).message}`);
      }
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`✓ DONE ${done}/${pending.length} 요약 완료${failed ? ` (실패 ${failed})` : ""} (${elapsed}s)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
