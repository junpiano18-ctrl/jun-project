// 의원 상태 수동 갱신.
//   npx tsx scripts/update-politician-status.ts
//
// 의원직 상실·직무정지·사망 등 외부 사건은 정식 자동 데이터 소스가 없어
// 사실이 확인되면 여기에 한 줄씩 추가해 일괄 갱신한다. 멱등.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type Update = {
  monaCd?: string;
  necId?: string;
  status: "ACTIVE" | "DISMISSED" | "SUSPENDED" | "DECEASED";
  reason?: string;
};

const UPDATES: Update[] = [
  { monaCd: "GDG1847Z", status: "DISMISSED", reason: "권성동 — 의원직 상실" },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });
  try {
    for (const u of UPDATES) {
      const where = u.monaCd ? { monaCd: u.monaCd } : { necId: u.necId };
      const p = await prisma.politician.findFirst({ where });
      if (!p) {
        console.warn(`✗ ${u.reason ?? JSON.stringify(u)} — 의원 찾을 수 없음`);
        continue;
      }
      const updated = await prisma.politicianTerm.updateMany({
        where: { politicianId: p.id },
        data: { status: u.status },
      });
      console.log(`✓ ${p.name} → ${u.status} (${updated.count} term)${u.reason ? ` · ${u.reason}` : ""}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
