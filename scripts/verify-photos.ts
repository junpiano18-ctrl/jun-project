// 의원 사진 매칭 교차 검증.
//   npx tsx scripts/verify-photos.ts [--fix]
//
// 알고리즘:
// 1) photoUrl 있는 의원마다 위키피디아 한국어 page extract fetch
//    ("{이름} (정치인)" 우선 → 없으면 "{이름}")
// 2) extract 본문에 의원 키워드 (정당명·지역구·"국회의원" 등) 포함 여부 검증
// 3) 키워드 0개 → 의심. 콘솔 출력
// 4) --fix 옵션: 의심 의원의 photoUrl을 null로 설정

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const UA = "naemeosum/0.1 (https://naemeosum.com; contact: junpiano18@gmail.com)";
const SLEEP_MS = 110;

const POSITION_KEYWORDS: Record<string, string[]> = {
  NATIONAL_ASSEMBLY: ["국회의원", "의원", "정치인"],
  METRO_GOVERNOR: ["시·도지사", "지사", "시장", "정치인"],
  LOCAL_GOVERNOR: ["시장", "군수", "구청장", "정치인"],
  EDUCATION_SUPERINTENDENT: ["교육감", "교육감 선거"],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wikiExtract(title: string): Promise<string | null> {
  const url = new URL("https://ko.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exsectionformat", "plain");
  url.searchParams.set("exchars", "1200");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query?: { pages?: Array<{ missing?: boolean; extract?: string }> };
  };
  const page = json.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.extract ?? null;
}

// 의원에 대한 키워드 빌드 — 정당명·지역구 토큰들·직급 키워드
function buildKeywords(
  partyName: string | null,
  districtName: string,
  positionType: string,
): string[] {
  const kws: string[] = [];
  if (partyName && partyName !== "무소속") kws.push(partyName);
  // 지역구 토큰: "서울 노원구을" → ["서울", "노원구", "노원"]
  const tokens = districtName.replace(/[갑을병정무]$/u, "").split(/\s+/);
  for (const t of tokens) {
    if (t.length >= 2 && t !== "비례대표") {
      kws.push(t);
      // "노원구"에서 "노원"도 매칭 가능하게
      const stripped = t.replace(/[시군구도]$/u, "");
      if (stripped.length >= 2 && stripped !== t) kws.push(stripped);
    }
  }
  kws.push(...(POSITION_KEYWORDS[positionType] ?? ["정치인"]));
  return kws;
}

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes("--fix");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const targets = await prisma.politician.findMany({
      where: { photoUrl: { not: null } },
      include: { terms: { include: { term: true, district: true, party: true } } },
      orderBy: { name: "asc" },
    });
    console.log(`검증 대상: ${targets.length}명${fix ? " (--fix 모드)" : ""}`);

    type Bad = { id: string; name: string; districtName: string; reason: string; photoUrl: string };
    const suspicious: Bad[] = [];
    const errors: string[] = [];
    let i = 0;

    for (const p of targets) {
      i++;
      const term = p.terms[0];
      const districtName = term?.district.name ?? "";
      const partyName = term?.party?.name ?? null;
      const positionType = term?.term.positionType ?? "";

      try {
        // 1) "{이름} (정치인)" 우선
        let extract = await wikiExtract(`${p.name} (정치인)`);
        await sleep(SLEEP_MS);
        if (!extract) {
          extract = await wikiExtract(p.name);
          await sleep(SLEEP_MS);
        }

        if (!extract || extract.length < 30) {
          suspicious.push({
            id: p.id,
            name: p.name,
            districtName,
            reason: "위키 페이지 없음 또는 본문 매우 짧음",
            photoUrl: p.photoUrl!,
          });
        } else {
          const keywords = buildKeywords(partyName, districtName, positionType);
          const matched = keywords.filter((k) => extract!.includes(k));
          if (matched.length === 0) {
            suspicious.push({
              id: p.id,
              name: p.name,
              districtName,
              reason: `키워드 매칭 0개. 검사: ${keywords.slice(0, 5).join(",")}`,
              photoUrl: p.photoUrl!,
            });
          }
        }
      } catch (e) {
        errors.push(`${p.name}: ${(e as Error).message}`);
      }

      if (i % 20 === 0 || i === targets.length) {
        process.stdout.write(
          `\r  ${i}/${targets.length} · 의심 ${suspicious.length} · 에러 ${errors.length}`,
        );
      }
    }
    process.stdout.write("\n");

    console.log(`\n─ 의심 의원 ${suspicious.length}명 ─`);
    for (const s of suspicious) {
      console.log(
        `  ✗ ${s.name} · ${s.districtName}\n    ${s.reason}\n    ${s.photoUrl.slice(0, 90)}`,
      );
    }
    if (errors.length) {
      console.log(`\n─ API 에러 ${errors.length}건 ─`);
      for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
    }

    if (fix && suspicious.length) {
      const ids = suspicious.map((s) => s.id);
      const result = await prisma.politician.updateMany({
        where: { id: { in: ids } },
        data: { photoUrl: null },
      });
      console.log(`\n✓ ${result.count}명 photoUrl null 처리`);
    } else if (suspicious.length) {
      console.log(`\n(--fix 옵션으로 한 번에 null 처리 가능)`);
    } else {
      console.log("\n✓ 모든 사진 검증 통과");
    }

    // 최종 통계
    const total = await prisma.politician.count();
    const withPhoto = await prisma.politician.count({ where: { photoUrl: { not: null } } });
    console.log(`\n남은 사진: ${withPhoto}/${total} (${((withPhoto / total) * 100).toFixed(1)}%)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
