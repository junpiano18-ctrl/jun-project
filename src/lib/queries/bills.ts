import { prisma } from "@/lib/db";

export type BillListItem = {
  billId: string;
  billName: string;
  billUrl: string | null;
  procDate: Date | null;
  voteTcnt: number;
  yesTcnt: number;
  noTcnt: number;
  blankTcnt: number;
  summary: string | null;
};

export type BillListResult = {
  bills: BillListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type BillFilter = "all" | "passed" | "rejected";

const PAGE_SIZE = 20;

// raw SQL로 통과/부결 필터 (yes > no = PASSED).
// 정확한 정족수는 의안 종류마다 다르지만 표시 목적상 단순 비교.
export async function listBills(opts: {
  q?: string;
  filter?: BillFilter;
  page?: number;
}): Promise<BillListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim() ?? "";
  const filter: BillFilter = opts.filter ?? "all";

  const conditions: string[] = [`"voteTcnt" > 0`];
  const params: Array<string | number> = [];

  if (q.length >= 2) {
    params.push(`%${q}%`);
    conditions.push(`"billName" LIKE $${params.length}`);
  }
  if (filter === "passed") conditions.push(`"yesTcnt" > "noTcnt"`);
  else if (filter === "rejected") conditions.push(`"yesTcnt" <= "noTcnt"`);

  const whereSql = conditions.join(" AND ");
  params.push(PAGE_SIZE);
  const limitParam = `$${params.length}`;
  params.push((page - 1) * PAGE_SIZE);
  const offsetParam = `$${params.length}`;

  const bills = (await prisma.$queryRawUnsafe(
    `SELECT "billId", "billName", "billUrl", "procDate",
            "voteTcnt", "yesTcnt", "noTcnt", "blankTcnt", "summary"
     FROM "PlenaryBill"
     WHERE ${whereSql}
     ORDER BY "procDate" DESC NULLS LAST, "billId" DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    ...params,
  )) as Array<{
    billId: string;
    billName: string;
    billUrl: string | null;
    procDate: Date | null;
    voteTcnt: number;
    yesTcnt: number;
    noTcnt: number;
    blankTcnt: number;
    summary: string | null;
  }>;

  const totalRows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "PlenaryBill" WHERE ${whereSql}`,
    ...params.slice(0, params.length - 2),
  )) as Array<{ n: number }>;
  const total = totalRows[0]?.n ?? 0;

  return {
    bills: bills.map((b) => ({
      billId: b.billId,
      billName: b.billName,
      billUrl: b.billUrl,
      procDate: b.procDate,
      voteTcnt: b.voteTcnt ?? 0,
      yesTcnt: b.yesTcnt ?? 0,
      noTcnt: b.noTcnt ?? 0,
      blankTcnt: b.blankTcnt ?? 0,
      summary: b.summary,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export type PartyTally = {
  partyName: string;
  partyColor: string;
  agree: number;
  disagree: number;
  abstain: number;
  absent: number;
  total: number;
};

export type BillDetail = {
  billId: string;
  billName: string;
  billUrl: string | null;
  procDate: Date | null;
  voteTcnt: number;
  yesTcnt: number;
  noTcnt: number;
  blankTcnt: number;
  summary: string | null;
  proposer: {
    name: string;
    monaCd: string | null;
    party: { name: string; color: string } | null;
  } | null;
  partyTallies: PartyTally[];
};

// "(박용갑의원 등 12인)" / "(국토교통위원장)" / "(대안)" 패턴에서 첫 발의자 이름 추출.
function extractProposerName(billName: string): string | null {
  // 의원 본인 발의: "(○○○의원 등 N인)" 또는 "(○○○의원 등)"
  const m = billName.match(/\(([가-힣]{2,4})의원\s*등/);
  if (m) return m[1];
  return null;
}

export async function getBillDetail(billId: string): Promise<BillDetail | null> {
  // PlenaryBill에 없는 발의 법안(본회의 처리 전)도 상세 페이지에서 보여줘야 함.
  // 둘 다 없으면 진짜 404.
  const [plenary, billRow] = await Promise.all([
    prisma.plenaryBill.findUnique({ where: { billId } }),
    prisma.bill.findUnique({
      where: { billId },
      include: {
        politician: {
          select: {
            name: true,
            monaCd: true,
            terms: {
              where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
              include: { party: true },
              take: 1,
            },
          },
        },
      },
    }),
  ]);
  if (!plenary && !billRow) return null;

  // 발의자 — Bill 테이블에서 매칭 시도. 안 되면 PlenaryBill billName 파싱.
  let proposer: BillDetail["proposer"] = null;
  if (billRow) {
    const term = billRow.politician.terms[0];
    proposer = {
      name: billRow.politician.name,
      monaCd: billRow.politician.monaCd,
      party: term?.party ? { name: term.party.name, color: term.party.color } : null,
    };
  } else if (plenary) {
    const parsed = extractProposerName(plenary.billName);
    if (parsed) {
      const found = await prisma.politicianTerm.findFirst({
        where: {
          term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
          politician: { name: parsed },
        },
        include: { politician: true, party: true },
      });
      if (found) {
        proposer = {
          name: found.politician.name,
          monaCd: found.politician.monaCd,
          party: found.party
            ? { name: found.party.name, color: found.party.color }
            : null,
        };
      } else {
        proposer = { name: parsed, monaCd: null, party: null };
      }
    }
  }

  // 정당별 찬반 — VoteRecord JOIN PoliticianTerm (22대 NA만) JOIN Party
  const partyRows: Array<{
    partyName: string;
    partyColor: string;
    result: "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT";
    cnt: bigint;
  }> = await prisma.$queryRaw`
    SELECT p."name" AS "partyName", p."color" AS "partyColor", v."result", COUNT(*)::bigint AS cnt
    FROM "VoteRecord" v
    JOIN "PoliticianTerm" pt ON pt."politicianId" = v."politicianId"
    JOIN "Term" t ON t."id" = pt."termId"
    LEFT JOIN "Party" p ON p."id" = pt."partyId"
    WHERE v."billId" = ${billId}
      AND t."positionType" = 'NATIONAL_ASSEMBLY'
      AND t."number" = 22
    GROUP BY p."name", p."color", v."result"
  `;
  const tallyMap = new Map<string, PartyTally>();
  for (const r of partyRows) {
    const key = r.partyName ?? "무소속";
    const color = r.partyColor ?? "#888888";
    if (!tallyMap.has(key)) {
      tallyMap.set(key, {
        partyName: key,
        partyColor: color,
        agree: 0,
        disagree: 0,
        abstain: 0,
        absent: 0,
        total: 0,
      });
    }
    const t = tallyMap.get(key)!;
    const n = Number(r.cnt);
    if (r.result === "AGREE") t.agree += n;
    else if (r.result === "DISAGREE") t.disagree += n;
    else if (r.result === "ABSTAIN") t.abstain += n;
    else if (r.result === "ABSENT") t.absent += n;
    t.total += n;
  }
  const partyTallies = [...tallyMap.values()].sort((a, b) => b.total - a.total);

  // PlenaryBill 우선 (표결 집계 + 요약 있음). 없으면 Bill 정보로만 채움.
  // procDate는 PlenaryBill엔 본회의 처리일, Bill엔 proposedAt(발의일)로 대체.
  if (plenary) {
    return {
      billId: plenary.billId,
      billName: plenary.billName,
      billUrl: plenary.billUrl,
      procDate: plenary.procDate,
      voteTcnt: plenary.voteTcnt ?? 0,
      yesTcnt: plenary.yesTcnt ?? 0,
      noTcnt: plenary.noTcnt ?? 0,
      blankTcnt: plenary.blankTcnt ?? 0,
      summary: plenary.summary,
      proposer,
      partyTallies,
    };
  }
  // billRow은 위 if (!plenary && !billRow) 분기에서 null 걸러진 후라 여기선 non-null.
  return {
    billId: billRow!.billId,
    billName: billRow!.billName,
    billUrl: billRow!.billUrl,
    procDate: billRow!.proposedAt,
    voteTcnt: 0,
    yesTcnt: 0,
    noTcnt: 0,
    blankTcnt: 0,
    summary: billRow!.summary,
    proposer,
    partyTallies,
  };
}
