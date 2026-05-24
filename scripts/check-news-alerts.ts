// 22대 국회의원 이름 + 위험 키워드로 뉴스 검색, 매칭 결과를 운영자 확인용으로 출력.
//   npx tsx scripts/check-news-alerts.ts [--source=naver]
//
// 정책: 이 스크립트는 DB를 절대 직접 변경하지 않음.
// 매칭된 후보를 stdout과 data/runtime/news-alerts-{YYYY-MM-DD}.json에 적기만 함.
// 운영자가 1차 검토 → 확정되면 set-court-ruling.ts / set-additional-role.ts 등으로 수동 반영.
//
// fetchNewsItems()는 현재 mock. 네이버 검색 API 키 발급 후 실제 구현으로 교체:
//   https://openapi.naver.com/v1/search/news.json?query=...&display=50&sort=date
//   header: X-Naver-Client-Id, X-Naver-Client-Secret

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const TERM_NUMBER = 22;
const POSITION_TYPE = "NATIONAL_ASSEMBLY" as const;

// 매칭 키워드. 추가/삭제는 여기서.
const ALERT_KEYWORDS = [
  "구속",
  "기소",
  "의원직 상실",
  "의원직상실",
  "탈당",
  "제명",
  "당원권 정지",
] as const;

type NewsItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string; // ISO or RFC822
  source: string; // 언론사
};

// 후보 매칭 결과 — 의원명 + 어떤 키워드가 매칭됐는지 + 원문 메타.
type AlertCandidate = {
  politicianName: string;
  matchedKeywords: string[];
  item: NewsItem;
};

// ─────────────────────────────────────────────────────────
// 뉴스 fetch — TODO: 네이버 검색 API 연동. 현재는 mock 데이터.
// 실제 구현 시 인자로 쿼리(의원명 또는 키워드)와 페이지 정보 받도록 변경.
// ─────────────────────────────────────────────────────────
async function fetchNewsItems(_query: string): Promise<NewsItem[]> {
  // mock: 빈 배열. 키워드/이름이 매칭되는 가짜 row를 한두 개 넣어보고 싶으면 여기서.
  return [];
}

function matchKeywords(text: string): string[] {
  return ALERT_KEYWORDS.filter((k) => text.includes(k));
}

async function main() {
  const args = process.argv.slice(2);
  const source = args.find((a) => a.startsWith("--source="))?.slice(9) ?? "naver";
  console.log(`뉴스 모니터링 시작 (source=${source})`);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    // 현역 22대 ACTIVE 의원 이름만 매칭 대상. (DISMISSED 등은 새 알림 의미 적음)
    const active = await prisma.politicianTerm.findMany({
      where: {
        status: "ACTIVE",
        term: { positionType: POSITION_TYPE, number: TERM_NUMBER },
      },
      include: { politician: true },
    });
    const names = active.map((t) => t.politician.name);
    const nameSet = new Set(names);
    console.log(`  매칭 대상: ${names.length}명`);

    const candidates: AlertCandidate[] = [];

    // 키워드 1개씩 검색해서 명단 매칭. mock일 땐 빈 결과지만 형상은 동일.
    for (const kw of ALERT_KEYWORDS) {
      const items = await fetchNewsItems(`국회의원 ${kw}`);
      for (const item of items) {
        const text = `${item.title} ${item.description}`;
        const matched = matchKeywords(text);
        if (matched.length === 0) continue;

        // 본문/제목에 등장하는 의원명 추출. 이름이 짧으면 오탐 가능 — 2글자 이름은
        // "성+이름 전체" 조합이 흔치 않을 수 있으므로 추후 임계점 튜닝 필요.
        for (const name of names) {
          if (name.length < 2) continue;
          if (text.includes(name) && nameSet.has(name)) {
            candidates.push({ politicianName: name, matchedKeywords: matched, item });
          }
        }
      }
    }

    // 같은 (의원, 기사 URL) 중복 제거.
    const dedup = new Map<string, AlertCandidate>();
    for (const c of candidates) {
      const k = `${c.politicianName}|${c.item.link}`;
      if (!dedup.has(k)) dedup.set(k, c);
    }
    const final = [...dedup.values()];

    console.log(`\n매칭 후보: ${final.length}건`);
    for (const c of final.slice(0, 30)) {
      console.log(
        `  • [${c.matchedKeywords.join(",")}] ${c.politicianName} — ${c.item.title}`,
      );
      console.log(`      ${c.item.source} · ${c.item.pubDate}`);
      console.log(`      ${c.item.link}`);
    }
    if (final.length > 30) console.log(`  ... 외 ${final.length - 30}건`);

    // 로그 저장 — 운영자가 나중에 봐도 ID 단위 추적 가능하도록 일별 파일.
    const dateStr = new Date().toISOString().slice(0, 10);
    const outPath = path.join(
      process.cwd(),
      "data",
      "runtime",
      `news-alerts-${dateStr}.json`,
    );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        { ranAt: new Date().toISOString(), source, candidates: final },
        null,
        2,
      ) + "\n",
      "utf-8",
    );
    console.log(`\n저장: ${path.relative(process.cwd(), outPath)}`);

    if (final.length === 0) {
      console.log("\n(mock fetch이므로 결과가 비었음. 네이버 API 연동 후 재실행.)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
