import { prisma } from "@/lib/db";

// 홈 화면 "오늘의 국회 📰" 피드용 통합 쿼리.
// 모두 최근순 N개씩만 — 검색 안 해도 매일 다른 컨텐츠가 보이도록.

export type RecentVote = {
  billId: string;
  billName: string;
  summary: string | null;
  procDate: Date | null;
  voteTcnt: number;
  yesTcnt: number;
  noTcnt: number;
  blankTcnt: number;
};

export type RecentBill = {
  billId: string;
  billName: string;
  summary: string | null;
  proposedAt: Date | null;
  billUrl: string;
  proposer: {
    routeId: string; // monaCd ?? necId
    name: string;
    partyName: string | null;
    partyColor: string | null;
  } | null;
};

export type RecentAsset = {
  routeId: string;
  name: string;
  partyColor: string | null;
  totalKrw: bigint; // 천원 단위
  changeKrw: bigint | null;
  year: number;
  disclosedAt: Date | null;
};

export type HomeFeed = {
  recentVotes: RecentVote[];
  recentBills: RecentBill[];
  recentAssets: RecentAsset[];
};

// 2x2 그리드 미리보기용 — 각 카드에 1건만 보여주고 "더보기" 링크.
const LIMIT = 1;

// 의원의 현재 임기·정당 추출 — terms는 electedDate desc로 정렬됐다고 가정.
function pickCurrentParty(
  terms: Array<{ party: { name: string; color: string } | null }>,
): { name: string; color: string } | null {
  for (const t of terms) {
    if (t.party) return t.party;
  }
  return null;
}

export async function getHomeFeed(): Promise<HomeFeed> {
  const [voteRows, billRows, assetRows] = await Promise.all([
    // ── 최근 본회의 표결 — procDate desc, voteTcnt > 0 (실제 표결 있었던 안건만) ──
    prisma.plenaryBill.findMany({
      where: { voteTcnt: { gt: 0 }, procDate: { not: null } },
      orderBy: [{ procDate: "desc" }, { billId: "desc" }],
      take: LIMIT,
      select: {
        billId: true,
        billName: true,
        summary: true,
        procDate: true,
        voteTcnt: true,
        yesTcnt: true,
        noTcnt: true,
        blankTcnt: true,
      },
    }),

    // ── 최근 발의 법안 — proposedAt desc + 발의 의원 정당색 ──
    prisma.bill.findMany({
      where: { proposedAt: { not: null } },
      orderBy: [{ proposedAt: "desc" }, { id: "desc" }],
      take: LIMIT,
      include: {
        politician: {
          include: {
            terms: {
              orderBy: { electedDate: "desc" },
              take: 3, // 보통 1~2개. 현직 + 직전.
              include: { party: true },
            },
          },
        },
      },
    }),

    // ── 최근 재산 공개 — disclosedAt 우선, 없으면 year desc ──
    // 동일 의원이 여러 해 신고했어도 최신 한 건만 보여주려면 distinct 처리가 필요.
    // 우선 단순 sort + take 후 politicianId 중복 제거.
    prisma.asset.findMany({
      where: { totalKrw: { gt: 0 } },
      orderBy: [{ disclosedAt: "desc" }, { year: "desc" }],
      take: LIMIT * 4, // 중복 제거 여유분
      include: {
        politician: {
          include: {
            terms: {
              orderBy: { electedDate: "desc" },
              take: 3,
              include: { party: true },
            },
          },
        },
      },
    }),
  ]);

  const recentVotes: RecentVote[] = voteRows.map((b) => ({
    billId: b.billId,
    billName: b.billName,
    summary: b.summary,
    procDate: b.procDate,
    voteTcnt: b.voteTcnt ?? 0,
    yesTcnt: b.yesTcnt ?? 0,
    noTcnt: b.noTcnt ?? 0,
    blankTcnt: b.blankTcnt ?? 0,
  }));

  const recentBills: RecentBill[] = billRows.map((b) => {
    const p = b.politician;
    const party = pickCurrentParty(p.terms);
    const routeId = p.monaCd ?? p.necId ?? p.id;
    return {
      billId: b.billId,
      billName: b.billName,
      summary: b.summary,
      proposedAt: b.proposedAt,
      billUrl: b.billUrl,
      proposer: {
        routeId,
        name: p.name,
        partyName: party?.name ?? null,
        partyColor: party?.color ?? null,
      },
    };
  });

  // politicianId 중복 제거 — 한 의원이 같은 회차에 여러 항목으로 신고된 경우 1건만.
  const seenPids = new Set<string>();
  const recentAssets: RecentAsset[] = [];
  for (const a of assetRows) {
    if (seenPids.has(a.politicianId)) continue;
    seenPids.add(a.politicianId);
    const party = pickCurrentParty(a.politician.terms);
    const routeId = a.politician.monaCd ?? a.politician.necId ?? a.politician.id;
    recentAssets.push({
      routeId,
      name: a.politician.name,
      partyColor: party?.color ?? null,
      totalKrw: a.totalKrw,
      changeKrw: a.changeKrw,
      year: a.year,
      disclosedAt: a.disclosedAt,
    });
    if (recentAssets.length >= LIMIT) break;
  }

  return { recentVotes, recentBills, recentAssets };
}
