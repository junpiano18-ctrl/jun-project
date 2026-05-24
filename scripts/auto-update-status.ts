// 22대 국회의원 현재 명단을 열린국회 API에서 다시 받아 DB와 diff.
//   npx tsx scripts/auto-update-status.ts [--dry-run] [--apply] [--skip-party]
//
// 알고리즘:
// - 열린국회 nwvrqwxyaytdsfvhu에 현재 명단(보통 ~290명) → DB의 22대 PoliticianTerm.status=ACTIVE와 비교
// - DB엔 있는데 명단엔 빠진 의원 → status=DISMISSED (사퇴·제명·사망 등 — 세부는 update-politician-status.ts로 보강)
// - 명단엔 있는데 DB엔 없는 의원 → 보궐 신규. 명단 row를 그대로 insert.
// - DB와 API의 정당이 다르면 → 3일 연속 같은 diff 관측 시 partyId 업데이트.
//   (API가 일시적으로 잘못된 값 내려주거나, 이탈→복귀 같은 단기 변동은 무시)
//
// 정기 cron으로 돌리면 의원 상태가 자동 동기화. 멱등 — 변경 없으면 0개 수정.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  fetchCurrentAssemblyMembers,
  type AssemblyMemberRow,
} from "../src/lib/sources/open-assembly";

const POSITION_TYPE = "NATIONAL_ASSEMBLY" as const;
const TERM_NUMBER = 22;
const ELECTED_DATE = new Date("2024-05-30");
const POSITION_TITLE = "국회의원";

// 같은 diff가 며칠 연속 관측돼야 자동 적용할지. 보통 열린국회 API는 1~3일 내 반영됨.
const PARTY_DIFF_REQUIRED_DAYS = 3;

// 추적 상태 파일 — gitignore된 data/runtime/ 아래.
// 같은 cron이 하루 두 번 돌아도 일 단위로 카운트되도록 firstSeen/lastSeen 두 날짜를 저장.
const TRACKER_PATH = path.join(
  process.cwd(),
  "data",
  "runtime",
  "party-change-tracker.json",
);

type PartyTrackerEntry = {
  apiParty: string;
  firstSeenDate: string; // YYYY-MM-DD
  lastSeenDate: string;
};
type PartyTracker = Record<string, PartyTrackerEntry>;

function parseBirthYear(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(b) - Date.parse(a)) / 86_400_000,
  );
}

function loadTracker(): PartyTracker {
  try {
    const raw = fs.readFileSync(TRACKER_PATH, "utf-8");
    return JSON.parse(raw) as PartyTracker;
  } catch {
    return {};
  }
}

function saveTracker(t: PartyTracker): void {
  fs.mkdirSync(path.dirname(TRACKER_PATH), { recursive: true });
  fs.writeFileSync(TRACKER_PATH, JSON.stringify(t, null, 2) + "\n", "utf-8");
}

type PartyDiff = {
  termId: string;
  monaCd: string;
  name: string;
  dbParty: string | null;
  apiParty: string;
  firstSeenDate: string;
  daysObserved: number; // 1=오늘 처음 본 diff
  newPartyId: string;
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") && !args.includes("--apply");
  const skipParty = args.includes("--skip-party");

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
      include: { politician: true, district: true, party: true },
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

    // ── diff 3: ACTIVE 중 정당 불일치 → 3일 연속 관측 시 partyId 업데이트 ──
    const parties = await prisma.party.findMany();
    const partyByName = new Map(parties.map((p) => [p.name, p]));
    const apiByMonaCd = new Map<string, AssemblyMemberRow>();
    for (const m of members) if (m.MONA_CD) apiByMonaCd.set(m.MONA_CD, m);

    const tracker = skipParty ? {} : loadTracker();
    const partyDiffs: PartyDiff[] = [];
    const partyReady: PartyDiff[] = []; // 3일 충족 → 적용 대상
    const partyUnknown: { monaCd: string; name: string; apiParty: string }[] = [];

    if (!skipParty) {
      const todayStr = today();

      for (const t of dbActive) {
        const monaCd = t.politician.monaCd;
        if (!monaCd) continue;
        const api = apiByMonaCd.get(monaCd);
        if (!api || !api.POLY_NM) {
          // 명단에서 빠졌거나(=diff1 케이스) 정당 미상. tracker 정리.
          if (tracker[monaCd]) delete tracker[monaCd];
          continue;
        }
        const apiParty = api.POLY_NM;
        const dbPartyName = t.party?.name ?? null;
        if (apiParty === dbPartyName) {
          if (tracker[monaCd]) delete tracker[monaCd];
          continue;
        }

        // API 정당 row가 DB에 없으면 — 신생 정당. 자동 적용은 위험하므로 알림만.
        const newParty = partyByName.get(apiParty);
        if (!newParty) {
          partyUnknown.push({ monaCd, name: t.politician.name, apiParty });
          // tracker 갱신은 의미 없음 (적용 못 함). 기존 entry 정리.
          if (tracker[monaCd]) delete tracker[monaCd];
          continue;
        }

        const prev = tracker[monaCd];
        if (prev && prev.apiParty === apiParty) {
          // 같은 diff 지속. lastSeenDate만 갱신 (이미 오늘이면 no-op).
          if (prev.lastSeenDate !== todayStr) prev.lastSeenDate = todayStr;
        } else {
          // 새 diff 또는 다른 apiParty로 변동 — 카운트 리셋.
          tracker[monaCd] = {
            apiParty,
            firstSeenDate: todayStr,
            lastSeenDate: todayStr,
          };
        }

        const entry = tracker[monaCd];
        const daysObserved =
          daysBetween(entry.firstSeenDate, entry.lastSeenDate) + 1;
        const diff: PartyDiff = {
          termId: t.id,
          monaCd,
          name: t.politician.name,
          dbParty: dbPartyName,
          apiParty,
          firstSeenDate: entry.firstSeenDate,
          daysObserved,
          newPartyId: newParty.id,
        };
        partyDiffs.push(diff);
        if (daysObserved >= PARTY_DIFF_REQUIRED_DAYS) partyReady.push(diff);
      }
    }

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

    if (!skipParty) {
      console.log(
        `  • 정당 변경 관측: ${partyDiffs.length}명 (그중 ${partyReady.length}명이 ${PARTY_DIFF_REQUIRED_DAYS}일 연속 관측됨 → 적용 대상)`,
      );
      for (const d of partyDiffs) {
        const flag = d.daysObserved >= PARTY_DIFF_REQUIRED_DAYS ? "✓ APPLY" : `... ${d.daysObserved}/${PARTY_DIFF_REQUIRED_DAYS}일`;
        console.log(
          `      - ${d.name} (monaCd=${d.monaCd}): ${d.dbParty ?? "(정당없음)"} → ${d.apiParty} [${flag}, since ${d.firstSeenDate}]`,
        );
      }
      if (partyUnknown.length > 0) {
        console.log(
          `  ⚠ 신생 정당 (DB Party 테이블에 없음) — 수동으로 Party row 추가 필요:`,
        );
        for (const u of partyUnknown) {
          console.log(`      - ${u.name} (monaCd=${u.monaCd}) → API: "${u.apiParty}"`);
        }
      }
    }

    if (dryRun) {
      console.log("\n(dry-run — 실제 변경 없음. tracker도 저장 안 함. --apply 옵션으로 실행)");
      return;
    }

    // tracker는 변경/적용 여부 무관히 매 run 저장 (firstSeenDate 누적이 핵심).
    if (!skipParty) saveTracker(tracker);

    if (
      removedTerms.length === 0 &&
      newMembers.length === 0 &&
      partyReady.length === 0
    ) {
      console.log("\n✓ 변경 없음. DB ↔ API 명단/정당 일치.");
      return;
    }

    // ── 실제 적용 ──
    for (const t of removedTerms) {
      await prisma.politicianTerm.update({
        where: { id: t.id },
        data: { status: "DISMISSED" },
      });
    }

    // 정당 변경 적용 + tracker entry 정리 (다음 run에서 같은 diff 재추적 방지).
    for (const d of partyReady) {
      await prisma.politicianTerm.update({
        where: { id: d.termId },
        data: { partyId: d.newPartyId },
      });
      delete tracker[d.monaCd];
    }
    if (!skipParty && partyReady.length > 0) saveTracker(tracker);

    const term = await prisma.term.findUniqueOrThrow({
      where: { positionType_number: { positionType: POSITION_TYPE, number: TERM_NUMBER } },
    });

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
      `\n✓ DISMISSED 처리 ${removedTerms.length}명 · 신규 보궐 ${inserted}명 등록 · 정당 변경 ${partyReady.length}명 적용`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
