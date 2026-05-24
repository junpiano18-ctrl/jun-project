import { prisma } from "@/lib/db";

export type PoliticianDetail = NonNullable<
  Awaited<ReturnType<typeof getPoliticianByMonaCd>>
>;

export async function getPoliticianByMonaCd(idOrMonaCd: string) {
  // 라우트 [monaCd]는 monaCd(국회의원) 또는 necId(광역단체장·교육감·기초단체장) 둘 다 받는다.
  const politician = await prisma.politician.findFirst({
    where: { OR: [{ monaCd: idOrMonaCd }, { necId: idOrMonaCd }] },
    include: {
      terms: {
        include: {
          term: true,
          district: true,
          party: true,
          // 최근 선거부터 + 같은 선거 내에선 순번대로.
          pledges: { orderBy: [{ electionDate: "desc" }, { ordNum: "asc" }] },
        },
        orderBy: { electedDate: "desc" },
      },
      assets: { orderBy: { year: "desc" } },
      bills: { orderBy: { proposedAt: "desc" } },
      voteRecords: { orderBy: { voteDate: "desc" } },
    },
  });
  if (!politician) return null;

  // 표결 이력 + PlenaryBill 매칭 (모든 본회의 처리안건 마스터). VoteRecord에는 billName/billUrl 있지만 summary/집계는 PlenaryBill에.
  const billIds = politician.voteRecords.map((v) => v.billId);
  const plenaryBills = billIds.length
    ? await prisma.plenaryBill.findMany({
        where: { billId: { in: billIds } },
        select: {
          billId: true,
          summary: true,
          voteTcnt: true,
          yesTcnt: true,
          noTcnt: true,
          blankTcnt: true,
        },
      })
    : [];
  const billMap = new Map(plenaryBills.map((b) => [b.billId, b]));

  const voteRecordsAugmented = politician.voteRecords.map((v) => {
    const b = billMap.get(v.billId);
    return {
      ...v,
      summary: b?.summary ?? null,
      voteTcnt: b?.voteTcnt ?? null,
      yesTcnt: b?.yesTcnt ?? null,
      noTcnt: b?.noTcnt ?? null,
      blankTcnt: b?.blankTcnt ?? null,
    };
  });
  const recentVoteRecords = voteRecordsAugmented.slice(0, 10);

  // 주목 표결 = 찬성률 40~60% (집계 데이터 있을 때만)
  const notableVoteRecords = voteRecordsAugmented.filter((v) => {
    if (!v.voteTcnt || !v.yesTcnt || v.voteTcnt <= 0) return false;
    const ratio = v.yesTcnt / v.voteTcnt;
    return ratio >= 0.4 && ratio <= 0.6;
  }).slice(0, 5);

  const currentTerm = politician.terms[0] ?? null;
  return {
    politician,
    currentTerm,
    pastTerms: politician.terms.slice(1),
    recentVoteRecords,
    notableVoteRecords,
  };
}
