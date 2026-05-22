// 법안 summary가 비어 있는 Bill에 Claude API를 호출해 요약을 채운다.
//
// 기본은 한 명·N건 한정 (예: --politician 정청래 --limit 5).
// ANTHROPIC_API_KEY가 없으면 안내만 출력하고 종료. idempotent — 이미 summary가 있으면 skip.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { summarizeBill } from "../src/lib/ai/bill-summary";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 429 rate limit 등 일시 오류 시 exponential backoff 재시도.
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      const err = e as { status?: number; message?: string };
      const transient =
        err.status === 429 || err.status === 529 || err.status === 503;
      if (transient && attempt <= 5) {
        const wait = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s, 16s, 32s
        console.warn(
          `  ⏳ ${label} rate-limit/transient(${err.status}), ${wait}ms 후 재시도 (${attempt}/5)`,
        );
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

function parseArgs(): {
  politicianName: string | null;
  limit: number | null;
  sampleActive: number | null;
  model: string | null;
} {
  const args = process.argv.slice(2);
  let politicianName: string | null = null;
  let limit: number | null = null;
  let sampleActive: number | null = null;
  let model: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--politician") politicianName = args[++i] ?? null;
    else if (args[i] === "--limit") limit = Number(args[++i]);
    else if (args[i] === "--sample-active") sampleActive = Number(args[++i]);
    else if (args[i] === "--model") model = args[++i] ?? null;
  }
  return { politicianName, limit, sampleActive, model };
}

// Sonnet 4.6: input $3 / MTok, output $15 / MTok (공개 가격, 추정).
// Haiku 4.5: input $1 / MTok, output $5 / MTok (추정).
function estimateCostUSD(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { in: number; out: number }> = {
    "claude-sonnet-4-6": { in: 3, out: 15 },
    "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  };
  const p = pricing[model] ?? pricing["claude-sonnet-4-6"];
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ ANTHROPIC_API_KEY가 비어 있습니다.");
    console.error("  .env에 채우고 다시 실행하세요.");
    process.exit(1);
  }

  const { politicianName, limit, sampleActive, model } = parseArgs();
  console.log(
    `대상: ${
      politicianName
        ? politicianName
        : sampleActive
        ? `활성 22대 의원 ${sampleActive}명`
        : "전체"
    } · 최대 ${limit ?? "전체"}건 · 모델: ${model ?? "default"} · 빈 summary만`,
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    // --sample-active N : 22대 NA의 status=ACTIVE 의원 중 monaCd 정렬 첫 N명.
    let politicianIds: string[] | null = null;
    if (sampleActive) {
      const terms = await prisma.politicianTerm.findMany({
        where: {
          status: "ACTIVE",
          term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
        },
        include: { politician: true },
        orderBy: { politician: { monaCd: "asc" } },
        take: sampleActive,
      });
      politicianIds = terms.map((t) => t.politicianId);
      console.log(
        `샘플 의원: ${terms.map((t) => t.politician.name).join(", ")}`,
      );
    }

    const pending = await prisma.bill.findMany({
      where: {
        summary: null,
        ...(politicianName ? { politician: { name: politicianName } } : {}),
        ...(politicianIds ? { politicianId: { in: politicianIds } } : {}),
      },
      orderBy: { proposedAt: "desc" },
      take: limit ?? undefined,
      include: { politician: true },
    });
    console.log(`요약 대상 Bill ${pending.length}건`);
    if (pending.length === 0) return;

    const VERBOSE = process.env.VERBOSE === "1" || pending.length <= 20;
    const MILESTONE_EVERY = 100;
    const startedAt = Date.now();
    let done = 0;
    let failed = 0;
    let inputTokensTotal = 0;
    let outputTokensTotal = 0;
    let usedModel = "";
    for (const b of pending) {
      try {
        const { summary, model: m, usage } = await withRetry(
          () => summarizeBill(b.billName, model ?? undefined),
          `[${b.politician.name}] ${b.billName.slice(0, 30)}`,
        );
        usedModel = m;
        inputTokensTotal += usage.inputTokens;
        outputTokensTotal += usage.outputTokens;
        await prisma.bill.update({
          where: { id: b.id },
          data: { summary },
        });
        done++;
        if (VERBOSE) {
          console.log(`  ✓ [${b.politician.name}] ${b.billName}`);
          console.log(`    → ${summary}`);
        } else if (done % MILESTONE_EVERY === 0) {
          const elapsedMs = Date.now() - startedAt;
          const rate = done / (elapsedMs / 1000);
          const remainSec = Math.round((pending.length - done) / rate);
          console.log(
            `  진행 ${done}/${pending.length} (${(rate).toFixed(2)} req/s, 남은 시간 ~${Math.round(remainSec / 60)}분)`,
          );
        }
        await sleep(200);
      } catch (e) {
        failed++;
        console.error(`  ✗ Bill ${b.id} 실패:`, (e as Error).message);
      }
    }
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const costUSD = usedModel
      ? estimateCostUSD(usedModel, inputTokensTotal, outputTokensTotal)
      : 0;
    console.log(`\n✓ ${done}/${pending.length} 요약 완료${failed ? ` (실패 ${failed})` : ""}`);
    console.log(
      `─ 모델: ${usedModel || "?"}` +
        `\n─ 토큰: input ${inputTokensTotal.toLocaleString()} / output ${outputTokensTotal.toLocaleString()}` +
        `\n─ 시간: ${Math.round(elapsedSec)}s` +
        `\n─ 비용 (추정): $${costUSD.toFixed(4)} (USD)`,
    );
    if (done > 0) {
      const per = costUSD / done;
      const projected16060 = per * 16060;
      console.log(
        `─ 호출당 평균: $${per.toFixed(5)} · 전체 16,060건 환산 시 ~$${projected16060.toFixed(2)}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
