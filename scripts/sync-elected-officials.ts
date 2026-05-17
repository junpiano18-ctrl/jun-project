// 선관위 당선인 API로 비국회의원 선출직 동기화.
//   npx tsx scripts/sync-elected-officials.ts [--dry-run] [--type=3|11|4]
//
// 대상 직급 (sgTypecode):
//   3  광역단체장 (17명, METRO_GOVERNOR)
//  11  교육감     (17명, EDUCATION_SUPERINTENDENT)
//   4  기초단체장 (226명, LOCAL_GOVERNOR)
//
// 모두 8회 전국동시지방선거(2022-06-01) 임기. 응답은 XML.

import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ENDPOINT =
  "https://apis.data.go.kr/9760000/WinnerInfoInqireService2/getWinnerInfoInqire";
const SG_ID_8TH = "20220601";
const TERM_8TH_START = new Date("2022-07-01");
const TERM_8TH_END = new Date("2026-06-30");

type SgTypecode = "3" | "11" | "4";

type TargetCfg = {
  sgTypecode: SgTypecode;
  positionType:
    | "METRO_GOVERNOR"
    | "EDUCATION_SUPERINTENDENT"
    | "LOCAL_GOVERNOR";
  positionTitle: string;
  expected: number;
};

const TARGETS: TargetCfg[] = [
  { sgTypecode: "3", positionType: "METRO_GOVERNOR", positionTitle: "시·도지사", expected: 17 },
  { sgTypecode: "11", positionType: "EDUCATION_SUPERINTENDENT", positionTitle: "교육감", expected: 17 },
  { sgTypecode: "4", positionType: "LOCAL_GOVERNOR", positionTitle: "시·군·구청장", expected: 226 },
];

// XML response item에 들어있는 주요 필드.
type RawWinner = {
  num?: number;
  sgId?: string;
  sgTypecode?: string;
  huboid?: string; // 후보 ID (외부 시스템 유일 식별자)
  sggName?: string; // 선거구명 (광역단체장은 시도명, 기초단체장은 시군구명)
  sdName?: string; // 시도명
  wiwName?: string; // 위원회명
  giho?: number;
  jdName?: string; // 정당명
  name?: string;
  hanjaName?: string;
  gender?: string; // "남" / "여"
  birthday?: string; // YYYYMMDD
  age?: number;
  addr?: string;
  job?: string;
  edu?: string;
  career1?: string;
};

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // 모두 string으로 — 빈 태그가 숫자로 잡히는 것 방지
  trimValues: true,
  isArray: (name) => name === "item",
});

async function fetchWinnersPage(
  key: string,
  sgTypecode: SgTypecode,
  pageNo: number,
  numOfRows: number,
): Promise<{ rows: RawWinner[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: key,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    sgId: SG_ID_8TH,
    sgTypecode,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml) as {
    response?: {
      header?: { resultCode?: string; resultMsg?: string };
      body?: {
        items?: { item?: RawWinner[] };
        totalCount?: string;
      };
    };
  };
  const code = parsed.response?.header?.resultCode;
  if (code && code !== "INFO-00" && code !== "00") {
    throw new Error(
      `API error: ${code} ${parsed.response?.header?.resultMsg ?? ""}`,
    );
  }
  const rows = parsed.response?.body?.items?.item ?? [];
  const totalCount = parseInt(parsed.response?.body?.totalCount ?? "0", 10);
  return { rows, totalCount };
}

// 모든 페이지를 순회해 전체 winner 반환. 게이트웨이가 numOfRows를 100으로 캡핑하는 케이스 대응.
async function fetchAllWinners(
  key: string,
  sgTypecode: SgTypecode,
): Promise<{ rows: RawWinner[]; totalCount: number }> {
  const PAGE_SIZE = 100;
  const first = await fetchWinnersPage(key, sgTypecode, 1, PAGE_SIZE);
  const total = first.totalCount;
  const acc = [...first.rows];
  const pages = Math.ceil(total / PAGE_SIZE);
  for (let p = 2; p <= pages; p++) {
    const next = await fetchWinnersPage(key, sgTypecode, p, PAGE_SIZE);
    acc.push(...next.rows);
  }
  return { rows: acc, totalCount: total };
}

function parseBirthYear(s: string | undefined): number | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function districtNameFor(cfg: TargetCfg, r: RawWinner): string {
  // 광역단체장·교육감: sdName(시도) 또는 sggName(=시도) 사용.
  // 기초단체장: sdName + sggName 조합. sggName이 자치단체명.
  if (cfg.sgTypecode === "4") {
    const sd = (r.sdName ?? "").trim();
    const sgg = (r.sggName ?? "").trim();
    if (sd && sgg) return `${sd} ${sgg}`;
    return sgg || sd || "(미상)";
  }
  return (r.sdName ?? r.sggName ?? "(미상)").trim();
}

async function syncTarget(prisma: PrismaClient, key: string, cfg: TargetCfg, dryRun: boolean) {
  console.log(`\n── ${cfg.positionTitle} (sgTypecode=${cfg.sgTypecode}, 예상 ${cfg.expected}명) ──`);
  const { rows, totalCount } = await fetchAllWinners(key, cfg.sgTypecode);
  console.log(`  fetched: ${rows.length} / totalCount: ${totalCount}`);

  if (rows.length === 0) {
    console.warn("  ✗ 응답 0건.");
    return;
  }

  if (dryRun) {
    console.log("  첫 row 키:", Object.keys(rows[0]).sort().join(", "));
    console.log("  앞 5명 매핑 미리보기:");
    for (const r of rows.slice(0, 5)) {
      const district = districtNameFor(cfg, r);
      const birth = parseBirthYear(r.birthday);
      console.log(
        `    - ${r.name} (huboid=${r.huboid}) | 정당=${r.jdName ?? "(무)"} | 선거구=${district} | ${birth ?? "?"}년생 ${r.gender ?? "?"}`,
      );
    }
    if (rows.length > 5) console.log(`    ... 외 ${rows.length - 5}명`);
    return;
  }

  const term = await prisma.term.upsert({
    where: { positionType_number: { positionType: cfg.positionType, number: 8 } },
    update: {},
    create: {
      positionType: cfg.positionType,
      number: 8,
      startDate: TERM_8TH_START,
      endDate: TERM_8TH_END,
    },
  });

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const unknownParties = new Set<string>();

  for (const r of rows) {
    if (!r.name) { skipped++; continue; }
    const districtName = districtNameFor(cfg, r);
    const district = await prisma.district.upsert({
      where: { positionType_name: { positionType: cfg.positionType, name: districtName } },
      update: {},
      create: {
        positionType: cfg.positionType,
        name: districtName,
        fullName: districtName,
        isProportional: false,
      },
    });

    let party = null;
    if (r.jdName) {
      party = await prisma.party.findUnique({ where: { name: r.jdName } });
      if (!party) unknownParties.add(r.jdName);
    }

    // huboid를 necId로 사용 (외부 시스템 유일 식별자).
    const necId = r.huboid ? String(r.huboid) : null;
    const data = {
      name: r.name,
      hanjaName: r.hanjaName ?? null,
      birthYear: parseBirthYear(r.birthday),
      gender: r.gender ?? null,
    };

    let politician = necId
      ? await prisma.politician.findFirst({ where: { necId } })
      : null;
    if (politician) {
      politician = await prisma.politician.update({
        where: { id: politician.id },
        data,
      });
      updated++;
    } else {
      politician = await prisma.politician.create({
        data: { ...data, necId },
      });
      inserted++;
    }

    const existingTerm = await prisma.politicianTerm.findUnique({
      where: { politicianId_termId: { politicianId: politician.id, termId: term.id } },
    });
    if (existingTerm) {
      await prisma.politicianTerm.update({
        where: { id: existingTerm.id },
        data: { districtId: district.id, partyId: party?.id ?? null },
      });
    } else {
      await prisma.politicianTerm.create({
        data: {
          politicianId: politician.id,
          termId: term.id,
          districtId: district.id,
          partyId: party?.id ?? null,
          positionTitle: cfg.positionTitle,
          electedAs: "CONSTITUENCY",
          electedDate: TERM_8TH_START,
        },
      });
    }
  }

  console.log(`  ✓ Politicians: +${inserted} 신규, ~${updated} 갱신`);
  if (skipped) console.log(`  ⚠ ${skipped} 건너뜀 (이름 없음)`);
  if (unknownParties.size) {
    console.log(`  ⚠ 시드 외 정당: ${[...unknownParties].join(", ")} (무소속 fallback)`);
  }
}

async function main() {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) {
    console.error("✗ DATA_GO_KR_API_KEY가 비어 있습니다.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const typeArg = args.find((a) => a.startsWith("--type="))?.split("=")[1];

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });
  try {
    const targets = typeArg ? TARGETS.filter((t) => t.sgTypecode === typeArg) : TARGETS;
    for (const t of targets) {
      try {
        await syncTarget(prisma, key, t, dryRun);
      } catch (e) {
        console.error(`  ✗ ${t.positionTitle} 실패:`, (e as Error).message);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
