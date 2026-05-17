// 열린국회정보 API → DB 동기화.
//   npx tsx scripts/sync-assembly.ts
//
// 22대 현역 국회의원 명단을 받아 Politician/District/PoliticianTerm을 upsert한다.
// 멱등 — 여러 번 돌려도 중복 row 안 생김. 이름·정당·지역구 변경 시 갱신됨.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { fetchCurrentAssemblyMembers } from "../src/lib/sources/open-assembly";

const TERM_NUMBER = 22;
const POSITION_TYPE = "NATIONAL_ASSEMBLY" as const;
const ELECTED_DATE = new Date("2024-05-30");
const POSITION_TITLE = "국회의원";

function extractBirthYear(bthDate: string | null): number | null {
  if (!bthDate) return null;
  const m = bthDate.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error("DIRECT_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Fetching assembly members from open.assembly.go.kr...");
    const { rows: members, totalCount } = await fetchCurrentAssemblyMembers(1, 500);
    console.log(`Received ${members.length} of ${totalCount}`);

    const term = await prisma.term.findUniqueOrThrow({
      where: { positionType_number: { positionType: POSITION_TYPE, number: TERM_NUMBER } },
    });

    const parties = await prisma.party.findMany();
    const partyByName = new Map(parties.map((p) => [p.name, p]));
    const independent = partyByName.get("무소속") ?? null;

    let insertedPoliticians = 0;
    let updatedPoliticians = 0;
    let insertedTerms = 0;
    let updatedTerms = 0;
    const unknownParties = new Set<string>();
    const skipped: string[] = [];

    for (const m of members) {
      if (!m.MONA_CD) {
        skipped.push(`${m.HG_NM}: MONA_CD 없음`);
        continue;
      }

      // 1. 지역구 / 비례대표 District
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

      // 2. Politician — monaCd가 nullable unique라 upsert 대신 findFirst+분기
      const data = {
        name: m.HG_NM,
        hanjaName: m.HJ_NM ?? null,
        birthYear: extractBirthYear(m.BTH_DATE),
        gender: m.SEX_GBN_NM ?? null,
      };
      const existing = await prisma.politician.findFirst({ where: { monaCd: m.MONA_CD } });
      const politician = existing
        ? await prisma.politician.update({ where: { id: existing.id }, data })
        : await prisma.politician.create({ data: { ...data, monaCd: m.MONA_CD } });
      if (existing) updatedPoliticians++;
      else insertedPoliticians++;

      // 3. 정당 매칭
      let party = null;
      if (m.POLY_NM) {
        party = partyByName.get(m.POLY_NM) ?? null;
        if (!party) unknownParties.add(m.POLY_NM);
      } else {
        party = independent;
      }

      // 4. PoliticianTerm
      const electedAs: "PROPORTIONAL" | "CONSTITUENCY" = isProportional
        ? "PROPORTIONAL"
        : "CONSTITUENCY";
      const termData = {
        districtId: district.id,
        partyId: party?.id ?? null,
        electedAs,
      };
      const existingTerm = await prisma.politicianTerm.findUnique({
        where: {
          politicianId_termId: { politicianId: politician.id, termId: term.id },
        },
      });
      if (existingTerm) {
        await prisma.politicianTerm.update({
          where: { id: existingTerm.id },
          data: termData,
        });
        updatedTerms++;
      } else {
        await prisma.politicianTerm.create({
          data: {
            ...termData,
            politicianId: politician.id,
            termId: term.id,
            positionTitle: POSITION_TITLE,
            electedDate: ELECTED_DATE,
          },
        });
        insertedTerms++;
      }
    }

    console.log(
      `✓ Politicians: +${insertedPoliticians} new, ~${updatedPoliticians} updated`,
    );
    console.log(`✓ PoliticianTerms: +${insertedTerms} new, ~${updatedTerms} updated`);
    if (unknownParties.size) {
      console.warn(`⚠ Unknown parties (시드에 없음): ${[...unknownParties].join(", ")}`);
    }
    if (skipped.length) {
      console.warn(`⚠ Skipped ${skipped.length}: ${skipped.slice(0, 5).join("; ")}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
