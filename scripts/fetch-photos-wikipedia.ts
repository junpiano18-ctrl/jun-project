// 의원 사진 fetch — 다단계 fallback.
//   npx tsx scripts/fetch-photos-wikipedia.ts [--only-missing] [--reset]
//
// 우선순위:
// 1) 위키피디아 한국어 직접 lookup: "{name} (정치인)" → "{name} (국회의원)" → "{name}"
// 2) 한국어 CirrusSearch: "{name} 정치인" → "{name} 국회의원"
// 3) 위키데이터 P18 (kowiki entity → Commons FilePath URL)
// 4) 영문 위키 (wikidata enwiki sitelink가 있으면 그 제목으로)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const UA = "naemeosum/0.1 (https://naemeosum.com; contact: junpiano18@gmail.com)";
const THUMB = 400;
const SLEEP_MS = 110;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 위키피디아: 제목 직접 lookup ──
async function wikipediaThumb(title: string, lang: "ko" | "en"): Promise<string | null> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("pithumbsize", String(THUMB));
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query?: { pages?: Array<{ missing?: boolean; thumbnail?: { source: string } }> };
  };
  const page = json.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.thumbnail?.source ?? null;
}

// ── 위키피디아 CirrusSearch: 키워드 검색 + 첫 결과 thumbnail ──
async function wikipediaSearchThumb(
  query: string,
  lang: "ko" | "en",
): Promise<string | null> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "3");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("pithumbsize", String(THUMB));
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    query?: { pages?: Array<{ index?: number; thumbnail?: { source: string } }> };
  };
  const pages = json.query?.pages ?? [];
  // 검색 순위(index) 오름차순으로 정렬해 가장 관련성 높은 결과부터.
  pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const p of pages) {
    if (p.thumbnail?.source) return p.thumbnail.source;
  }
  return null;
}

// ── 위키데이터 ──
type WdResponse = {
  entities?: Record<
    string,
    {
      claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> };
      sitelinks?: { enwiki?: { title?: string } };
    }
  >;
};

async function wikidata(name: string): Promise<{
  imageUrl: string | null;
  enwikiTitle: string | null;
}> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("sites", "kowiki");
  url.searchParams.set("titles", name);
  url.searchParams.set("props", "claims|sitelinks");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return { imageUrl: null, enwikiTitle: null };
  const json = (await res.json()) as WdResponse;
  const entities = json.entities ?? {};
  for (const id of Object.keys(entities)) {
    if (id.startsWith("-")) continue;
    const ent = entities[id];
    const filename = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    return {
      imageUrl: filename
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${THUMB}`
        : null,
      enwikiTitle: ent.sitelinks?.enwiki?.title ?? null,
    };
  }
  return { imageUrl: null, enwikiTitle: null };
}

// ── 통합 fallback ──
async function findPhoto(name: string): Promise<{ url: string | null; source: string }> {
  // 1-1) 한국어 위키 "{name} (정치인)" disambig
  let url = await wikipediaThumb(`${name} (정치인)`, "ko");
  if (url) return { url, source: "ko-wiki:정치인" };
  await sleep(SLEEP_MS);

  // 1-2) "{name} (국회의원)" disambig
  url = await wikipediaThumb(`${name} (국회의원)`, "ko");
  if (url) return { url, source: "ko-wiki:국회의원" };
  await sleep(SLEEP_MS);

  // 1-3) "{name}" 단순
  url = await wikipediaThumb(name, "ko");
  if (url) return { url, source: "ko-wiki:이름만" };
  await sleep(SLEEP_MS);

  // 2-1) CirrusSearch "{name} 정치인"
  url = await wikipediaSearchThumb(`${name} 정치인`, "ko");
  if (url) return { url, source: "ko-search:정치인" };
  await sleep(SLEEP_MS);

  // 2-2) CirrusSearch "{name} 국회의원"
  url = await wikipediaSearchThumb(`${name} 국회의원`, "ko");
  if (url) return { url, source: "ko-search:국회의원" };
  await sleep(SLEEP_MS);

  // 3) 위키데이터 P18
  const wd = await wikidata(name);
  if (wd.imageUrl) return { url: wd.imageUrl, source: "wikidata-P18" };
  await sleep(SLEEP_MS);

  // 4) 영문 위키 (sitelink가 있을 때만, 동명이인 위험 피하기)
  if (wd.enwikiTitle) {
    url = await wikipediaThumb(wd.enwikiTitle, "en");
    if (url) return { url, source: "en-wiki:sitelink" };
    await sleep(SLEEP_MS);
  }

  return { url: null, source: "(none)" };
}

async function main() {
  const args = process.argv.slice(2);
  const onlyMissing = args.includes("--only-missing");
  const reset = args.includes("--reset");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    if (reset) {
      await prisma.politician.updateMany({ data: { photoUrl: null } });
      console.log("✓ 모든 photoUrl 초기화");
    }

    const where = onlyMissing ? { photoUrl: null } : {};
    const politicians = await prisma.politician.findMany({
      where,
      orderBy: { name: "asc" },
    });
    console.log(`대상: ${politicians.length}명${onlyMissing ? " (사진 없음만)" : ""}`);

    const bySource = new Map<string, number>();
    const failed: string[] = [];
    let i = 0;
    for (const p of politicians) {
      i++;
      try {
        const { url, source } = await findPhoto(p.name);
        bySource.set(source, (bySource.get(source) ?? 0) + 1);
        if (url) {
          await prisma.politician.update({
            where: { id: p.id },
            data: { photoUrl: url },
          });
        } else {
          failed.push(p.name);
        }
        if (i % 20 === 0 || i === politicians.length) {
          process.stdout.write(
            `\r  ${i}/${politicians.length} · 매칭 ${i - failed.length} · 미매칭 ${failed.length}`,
          );
        }
      } catch (e) {
        failed.push(p.name);
        console.error(`\n  ✗ ${p.name}:`, (e as Error).message);
      }
    }
    process.stdout.write("\n");

    console.log("\n— 소스별 매칭 —");
    for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${src}: ${n}`);
    }

    if (failed.length) {
      console.log(`\n— 사진 미매칭 ${failed.length}명 (앞 50명) —`);
      for (const name of failed.slice(0, 50)) console.log(`  ${name}`);
      if (failed.length > 50) console.log(`  ... 외 ${failed.length - 50}명`);
    }

    const matched = politicians.length - failed.length;
    console.log(
      `\n✓ 매칭 ${matched}/${politicians.length} (${((matched / politicians.length) * 100).toFixed(1)}%)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
