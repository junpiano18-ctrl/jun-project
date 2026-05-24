// 본회의 처리 안건(PlenaryBill)에 AI 요약(summary)을 일괄 채운다.
//   npx tsx scripts/summarize-plenary-bills.ts [--concurrency=N] [--model=ID] [--limit=N]
//
// 입력은 PlenaryBill.billName 한 줄 (본문은 없음). summarizeBill() 재사용 — 같은 system prompt 정책.
// 멱등 — summary가 이미 있으면 skip. 다시 돌려도 안전.
// concurrency=2 + Haiku 4.5 max_tokens=200 = ~5k OPM/min, 50 RPM tier 안.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { summarizeBill } from "../src/lib/ai/bill-summary";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// 단순 async pool — 동시 처리 N개 유지하며 작업 소진.
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

function parseArg(name: string): string | null {
  const args = process.argv.slice(2);
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ ANTHROPIC_API_KEY가 비어 있습니다.");
    process.exit(1);
  }

  const concurrency = Number(parseArg("concurrency") ?? "2");
  const model = parseArg("model") ?? DEFAULT_MODEL;
  const limitArg = parseArg("limit");
  const limit = limitArg ? Number(limitArg) : null;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const pending = await prisma.plenaryBill.findMany({
      where: { summary: null },
      orderBy: { procDate: "desc" },
      take: limit ?? undefined,
      select: { billId: true, billName: true },
    });
    console.log(
      `요약 대상 PlenaryBill ${pending.length}건 (concurrency=${concurrency}, model=${model})`,
    );
    if (pending.length === 0) return;

    let done = 0;
    let failed = 0;
    let inputTokensTotal = 0;
    let outputTokensTotal = 0;
    const startedAt = Date.now();

    await runPool(pending, concurrency, async (b) => {
      try {
        const { summary, model: m, usage } = await summarizeBill(b.billName, model);
        await prisma.plenaryBill.update({
          where: { billId: b.billId },
          data: {
            summary,
            summaryModel: m,
            summaryUpdatedAt: new Date(),
          },
        });
        done++;
        inputTokensTotal += usage.inputTokens;
        outputTokensTotal += usage.outputTokens;
        if (done % 50 === 0 || done === pending.length) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          console.log(`progress ${done}/${pending.length} (${elapsed}s)`);
        }
      } catch (e) {
        failed++;
        console.error(`✗ PlenaryBill ${b.billId} 실패: ${(e as Error).message}`);
      }
    });

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    // Haiku 4.5: $1/M input, $5/M output.
    const costUSD =
      (inputTokensTotal / 1_000_000) * 1 + (outputTokensTotal / 1_000_000) * 5;
    console.log(
      `✓ DONE ${done}/${pending.length} 요약 완료${failed ? ` (실패 ${failed})` : ""} (${elapsedSec}s)`,
    );
    console.log(
      `─ 토큰: input ${inputTokensTotal.toLocaleString()} / output ${outputTokensTotal.toLocaleString()}`,
    );
    console.log(`─ 비용 (추정): $${costUSD.toFixed(4)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
