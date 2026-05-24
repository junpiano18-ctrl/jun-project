// 선관위 선거공약(ElecPrmsInfoInqireService)으로 지방선출직 8회 공약 동기화.
//   npx tsx scripts/sync-pledges.ts [--dry-run] [--type=3|4|11]
//
// 대상 (8회 전국동시지방선거, sgId=20220601):
//   3   광역단체장 (METRO_GOVERNOR, 17명)
//   11  교육감     (EDUCATION_SUPERINTENDENT, 17명)
//   4   기초단체장 (LOCAL_GOVERNOR, 226명)
//
// 매핑: Politician.necId == cnddtId (== winner API huboid). 둘은 같은 값을 다른 이름으로 받음.
// idempotent: (politicianTermId, ordNum)에 upsert. 같은 ord에 텍스트가 바뀌면 update.
// easySummary는 건드리지 않음 — summarize-pledges.ts가 별도로 채움.
//
// 참고: 사양 페이지엔 prmsContent1~10이라 적혀 있으나 실제 응답은 prmmCont1~10. 응답 기준 사용.

import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const ENDPOINT =
  "https://apis.data.go.kr/9760000/ElecPrmsInfoInqireService/getCnddtElecPrmsInfoInqire";
const SG_ID_8TH = "20220601";
// sgId YYYYMMDD → Date. UTC 자정으로 normalize (timezone-free 비교).
const ELECTION_DATE_8TH = new Date(
  `${SG_ID_8TH.slice(0, 4)}-${SG_ID_8TH.slice(4, 6)}-${SG_ID_8TH.slice(6, 8)}T00:00:00Z`,
);

type SgTypecode = "3" | "11" | "4";

type TargetCfg = {
  sgTypecode: SgTypecode;
  positionType:
    | "METRO_GOVERNOR"
    | "EDUCATION_SUPERINTENDENT"
    | "LOCAL_GOVERNOR";
  termNumber: number;
  label: string;
};

const TARGETS: TargetCfg[] = [
  { sgTypecode: "3", positionType: "METRO_GOVERNOR", termNumber: 8, label: "광역단체장" },
  { sgTypecode: "11", positionType: "EDUCATION_SUPERINTENDENT", termNumber: 8, label: "교육감" },
  { sgTypecode: "4", positionType: "LOCAL_GOVERNOR", termNumber: 8, label: "기초단체장" },
];

// API 응답의 단일 row. wide 구조 — prmsOrd{N}/prmsTitle{N}/prmsRealmName{N}/prmmCont{N} for N=1..10.
type RawPledgeRow = Record<string, string | undefined> & {
  cnddtId?: string;
  krName?: string;
  prmsCnt?: string;
};

type ParsedPledge = {
  ordNum: number;
  title: string;
  category: string | null;
  originalText: string;
};

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "item",
});

function extractPledges(row: RawPledgeRow): ParsedPledge[] {
  const out: ParsedPledge[] = [];
  for (let i = 1; i <= 10; i++) {
    const title = (row[`prmsTitle${i}`] ?? "").trim();
    const content = (row[`prmmCont${i}`] ?? "").trim();
    // title도 content도 비어있으면 빈 슬롯 — 건너뜀.
    if (!title && !content) continue;
    // title만 비어있으면 사실상 데이터 누락. 본문이 있으니 임시 title로 채워 넣음.
    const realm = (row[`prmsRealmName${i}`] ?? "").trim();
    out.push({
      ordNum: i,
      title: title || `공약 ${i}`,
      category: realm || null,
      originalText: content,
    });
  }
  return out;
}

async function fetchPledges(
  key: string,
  cnddtId: string,
  sgTypecode: SgTypecode,
): Promise<{ ok: boolean; pledges: ParsedPledge[]; resultCode: string; resultMsg: string }> {
  const params = new URLSearchParams({
    serviceKey: key,
    pageNo: "1",
    numOfRows: "20",
    sgId: SG_ID_8TH,
    sgTypecode,
    cnddtId,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  const text = await res.text();
  const parsed = parser.parse(text) as {
    response?: {
      header?: { resultCode?: string; resultMsg?: string };
      body?: { items?: { item?: RawPledgeRow[] }; totalCount?: string };
    };
  };
  const header = parsed.response?.header ?? {};
  const resultCode = header.resultCode ?? "?";
  const resultMsg = header.resultMsg ?? "";

  // 정상: INFO-00 (또는 빈 헤더). 응답 본문이 비었어도(예: 공약 미등록 후보) 그건 정상 케이스.
  if (resultCode && resultCode !== "INFO-00" && resultCode !== "00") {
    return { ok: false, pledges: [], resultCode, resultMsg };
  }

  const items = parsed.response?.body?.items?.item ?? [];
  if (items.length === 0) return { ok: true, pledges: [], resultCode, resultMsg };

  const pledges = extractPledges(items[0]);
  return { ok: true, pledges, resultCode, resultMsg };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function syncTarget(
  prisma: PrismaClient,
  key: string,
  cfg: TargetCfg,
  dryRun: boolean,
): Promise<{ politicianCount: number; pledgeInserted: number; pledgeUpdated: number; noPledge: number; errors: number }> {
  console.log(`\n── ${cfg.label} (sgTypecode=${cfg.sgTypecode}) ──`);

  // 해당 직급의 8회 ACTIVE PoliticianTerm 모두. necId 없는 row는 매칭 불가 → skip.
  const terms = await prisma.politicianTerm.findMany({
    where: { term: { positionType: cfg.positionType, number: cfg.termNumber } },
    include: { politician: true, district: true },
  });
  const withNecId = terms.filter((t) => t.politician.necId);
  console.log(
    `  대상 PoliticianTerm: ${terms.length}건 (necId 있음 ${withNecId.length}, 없음 ${terms.length - withNecId.length})`,
  );

  let pledgeInserted = 0;
  let pledgeUpdated = 0;
  let noPledge = 0;
  let errors = 0;

  for (let idx = 0; idx < withNecId.length; idx++) {
    const t = withNecId[idx];
    const cnddtId = t.politician.necId!;
    const progress = `[${idx + 1}/${withNecId.length}]`;
    try {
      const { ok, pledges, resultCode, resultMsg } = await fetchPledges(key, cnddtId, cfg.sgTypecode);
      if (!ok) {
        console.warn(`  ${progress} ✗ ${t.politician.name} (cnddtId=${cnddtId}) — ${resultCode} ${resultMsg}`);
        errors++;
      } else if (pledges.length === 0) {
        if (idx < 5 || idx % 50 === 0) {
          console.log(`  ${progress} · ${t.politician.name}: 공약 미등록`);
        }
        noPledge++;
      } else {
        if (idx < 5 || idx % 25 === 0) {
          console.log(`  ${progress} ✓ ${t.politician.name} (${t.district.name}): ${pledges.length}개`);
        }
        if (!dryRun) {
          for (const p of pledges) {
            const result = await prisma.pledge.upsert({
              where: {
                politicianTermId_ordNum: {
                  politicianTermId: t.id,
                  ordNum: p.ordNum,
                },
              },
              create: {
                politicianTermId: t.id,
                ordNum: p.ordNum,
                title: p.title,
                category: p.category,
                originalText: p.originalText,
                electionDate: ELECTION_DATE_8TH,
                // source는 schema default "중앙선거관리위원회".
                // easySummary/status는 의도적으로 set 안 함.
              },
              update: {
                title: p.title,
                category: p.category,
                originalText: p.originalText,
                electionDate: ELECTION_DATE_8TH,
                // easySummary는 update에서도 건드리지 않음 — 본문이 바뀌면 summary는 별도 재생성 필요.
              },
            });
            // upsert는 createdAt이 같으면 update로 판단 — Prisma가 별도 표시 안 함.
            // 정확한 inserted/updated 분리는 추가 쿼리 비용이라 생략, 합계만 잡음.
            void result;
          }
          pledgeInserted += pledges.length;
        }
      }
    } catch (e) {
      console.error(`  ${progress} ✗ ${t.politician.name} throw:`, (e as Error).message);
      errors++;
    }
    // data.go.kr 게이트웨이 부하 회피. 260명 × ~150ms = 약 40초.
    await sleep(150);
  }

  return {
    politicianCount: withNecId.length,
    pledgeInserted,
    pledgeUpdated,
    noPledge,
    errors,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const typeArg = args.find((a) => a.startsWith("--type="))?.slice(7);
  const filter = typeArg ? (typeArg.split(",") as SgTypecode[]) : null;

  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) {
    console.error("✗ DATA_GO_KR_API_KEY 비어 있음.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const startedAt = Date.now();
    const targets = filter ? TARGETS.filter((t) => filter.includes(t.sgTypecode)) : TARGETS;

    let totalPoliticians = 0;
    let totalPledges = 0;
    let totalNoPledge = 0;
    let totalErrors = 0;

    for (const cfg of targets) {
      const r = await syncTarget(prisma, key, cfg, dryRun);
      totalPoliticians += r.politicianCount;
      totalPledges += r.pledgeInserted;
      totalNoPledge += r.noPledge;
      totalErrors += r.errors;
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `\n${dryRun ? "[DRY-RUN] " : ""}완료 — 대상 ${totalPoliticians}명, 저장 ${totalPledges}건, 공약 미등록 ${totalNoPledge}명, 오류 ${totalErrors}건 (${elapsed}s)`,
    );

    if (!dryRun) {
      const dbCount = await prisma.pledge.count();
      console.log(`DB Pledge 총합: ${dbCount}건`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
