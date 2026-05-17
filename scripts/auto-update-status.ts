// 22대 국회의원 현재 명단을 열린국회 API에서 다시 받아 DB와 diff.
//   npx tsx scripts/auto-update-status.ts [--dry-run] [--apply]
//
// 알고리즘:
// - 열린국회 nwvrqwxyaytdsfvhu에 현재 명단(보통 ~290명) → DB의 22대 PoliticianTerm.status=ACTIVE와 비교
// - DB엔 있는데 명단엔 빠진 의원 → status=DISMISSED (사퇴·제명·사망 등 — 세부는 update-politician-status.ts로 보강)
// - 명단엔 있는데 DB엔 없는 의원 → 보궐 신규. 명단 row를 그대로 insert.
//
// 정기 cron으로 돌리면 의원 상태가 자동 동기화. 멱등 — 변경 없으면 0개 수정.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { fetchCurrentAssemblyMembers } from "../src/lib/sources/open-assembly";

const POSITION_TYPE = "NATIONAL_ASSEMBLY" as const;
const TERM_NUMBER = 22;
const ELECTED_DATE = new Date("2024-05-30");
const POSITION_TITLE = "국회의원";

function parseBirthYear(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") && !args.includes("--apply");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    console.log("열린국회 API에서 22대 현재 의원 명단 fetch...");
    const { rows: members } = await fetchCurrentAssemblyMembers(1, 500);
    console.log(`  API 응답: ${members.length}명`);

    const apiMonaCds = new Set<string>();
    for (const m of members) if (m.MONA_CD) apiMonaCds.add(m.MONA_CD);

    // ── DB의 22대 모든 의원 (status 무관) ──
    const dbAll = await prisma.politicianTerm.findMany({
      where: { term: { positionType: POSITION_TYPE, number: TERM_NUMBER } },
      include: { politician: true, district: true },
    });
    const dbActive = dbAll.filter((t) => t.status === "ACTIVE");
    console.log(`  DB 전체: ${dbAll.length}명 (ACTIVE ${dbActive.length}, 그 외 ${dbAll.length - dbActive.length})`);

    // ── diff 1: ACTIVE 중 API에서 빠진 의원 → DISMISSED ──
    const removedTerms = dbActive.filter(
      (t) => !t.politician.monaCd || !apiMonaCds.has(t.politician.monaCd),
    );

    // ── diff 2: API 명단엔 있는데 DB에 아예 PoliticianTerm이 없는 의원 → 진짜 신규 보궐.
    //   DB에 PoliticianTerm 있지만 DISMISSED 등인 의원은 사용자 수동 입력이라 건드리지 않음.
    const dbMonaCds = new Set(
      dbAll.map((t) => t.politician.monaCd).filter(Boolean) as string[],
    );
    const newMembers = members.filter((m) => m.MONA_CD && !dbMonaCds.has(m.MONA_CD));

    console.log(`\n변경 요약:`);
    console.log(`  • DISMISSED 처리 대상: ${removedTerms.length}명`);
    for (const t of removedTerms.slice(0, 10)) {
      console.log(`      - ${t.politician.name} · ${t.district.name} (monaCd=${t.politician.monaCd})`);
    }
    if (removedTerms.length > 10) console.log(`      ... 외 ${removedTerms.length - 10}명`);

    console.log(`  • 신규 보궐 등록 대상: ${newMembers.length}명`);
    for (const m of newMembers.slice(0, 10)) {
      console.log(`      - ${m.HG_NM} · ${m.ORIG_NM ?? m.POLY_NM ?? ""} (monaCd=${m.MONA_CD})`);
    }
    if (newMembers.length > 10) console.log(`      ... 외 ${newMembers.length - 10}명`);

    if (dryRun) {
      console.log("\n(dry-run — 실제 변경 없음. --apply 옵션으로 실행)");
      return;
    }

    if (removedTerms.length === 0 && newMembers.length === 0) {
      console.log("\n✓ 변경 없음. DB ↔ API 명단 일치.");
      return;
    }

    // ── 실제 적용 ──
    for (const t of removedTerms) {
      await prisma.politicianTerm.update({
        where: { id: t.id },
        data: { status: "DISMISSED" },
      });
    }

    const term = await prisma.term.findUniqueOrThrow({
      where: { positionType_number: { positionType: POSITION_TYPE, number: TERM_NUMBER } },
    });
    const parties = await prisma.party.findMany();
    const partyByName = new Map(parties.map((p) => [p.name, p]));

    let inserted = 0;
    for (const m of newMembers) {
      if (!m.MONA_CD || !m.HG_NM) continue;
      const isProportional = m.ELECT_GBN_NM === "비례대표";
      const districtName = isProportional ? "비례대표" : m.ORIG_NM ?? "(미상)";
      const district = await prisma.district.upsert({
        where: { positionType_name: { positionType: POSITION_TYPE, name: districtName } },
        update: {},
        create: {
          positionType: POSITION_TYPE,
          name: districtName,
          fullName: districtName,
          isProportional,
        },
      });
      const party = m.POLY_NM ? partyByName.get(m.POLY_NM) ?? null : null;
      const existing = await prisma.politician.findFirst({ where: { monaCd: m.MONA_CD } });
      const politician = existing
        ? await prisma.politician.update({
            where: { id: existing.id },
            data: { name: m.HG_NM, hanjaName: m.HJ_NM, birthYear: parseBirthYear(m.BTH_DATE), gender: m.SEX_GBN_NM },
          })
        : await prisma.politician.create({
            data: {
              name: m.HG_NM,
              hanjaName: m.HJ_NM,
              birthYear: parseBirthYear(m.BTH_DATE),
              gender: m.SEX_GBN_NM,
              monaCd: m.MONA_CD,
            },
          });
      await prisma.politicianTerm.create({
        data: {
          politicianId: politician.id,
          termId: term.id,
          districtId: district.id,
          partyId: party?.id ?? null,
          positionTitle: POSITION_TITLE,
          electedAs: isProportional ? "PROPORTIONAL" : "CONSTITUENCY",
          electedDate: ELECTED_DATE,
          status: "ACTIVE",
        },
      });
      inserted++;
    }

    console.log(
      `\n✓ DISMISSED 처리 ${removedTerms.length}명 · 신규 보궐 ${inserted}명 등록 완료`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
