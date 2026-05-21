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

function parseArgs(): { politicianName: string | null; limit: number | null } {
  const args = process.argv.slice(2);
  let politicianName: string | null = null;
  let limit: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--politician") politicianName = args[++i] ?? null;
    else if (args[i] === "--limit") limit = Number(args[++i]);
  }
  return { politicianName, limit };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ ANTHROPIC_API_KEY가 비어 있습니다.");
    console.error("  .env에 채우고 다시 실행하세요.");
    process.exit(1);
  }

  const { politicianName, limit } = parseArgs();
  console.log(
    `대상: ${politicianName ?? "전체"} · 최대 ${limit ?? "전체"}건 · 빈 summary만`,
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const pending = await prisma.bill.findMany({
      where: {
        summary: null,
        ...(politicianName ? { politician: { name: politicianName } } : {}),
      },
      orderBy: { proposedAt: "desc" },
      take: limit ?? undefined,
      include: { politician: true },
    });
    console.log(`요약 대상 Bill ${pending.length}건`);
    if (pending.length === 0) return;

    let done = 0;
    let failed = 0;
    for (const b of pending) {
      try {
        const { summary } = await summarizeBill(b.billName);
        await prisma.bill.update({
          where: { id: b.id },
          data: { summary },
        });
        done++;
        console.log(`  ✓ [${b.politician.name}] ${b.billName}`);
        console.log(`    → ${summary}`);
        await sleep(200);
      } catch (e) {
        failed++;
        console.error(`  ✗ Bill ${b.id} 실패:`, (e as Error).message);
      }
    }
    console.log(`\n✓ ${done}/${pending.length} 요약 완료${failed ? ` (실패 ${failed})` : ""}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
