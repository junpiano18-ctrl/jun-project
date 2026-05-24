import { prisma } from "@/lib/db";
import {
  getElectedOfficialsByAdmCd,
  type ElectedOfficial,
} from "@/lib/queries/region-officials";

export type OfficialActivity =
  | {
      kind: "bill";
      id: string;
      at: string; // ISO — RSC 경계 직렬화 안정성 위해 문자열
      billId: string;
      billName: string;
      billUrl: string;
      summary: string | null;
      billStatus: "PENDING" | "PASSED" | "REJECTED";
    }
  | {
      kind: "vote";
      id: string;
      at: string;
      billId: string;
      billName: string;
      billUrl: string | null;
      result: "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT";
    };

export type OfficialWithActivity = ElectedOfficial & {
  activities: OfficialActivity[]; // 최근순, 최대 ACTIVITY_LIMIT개
  assetTotalKrw: number | null; // 천원 단위 (BigInt → number)
  assetYear: number | null;
};

export type RegionFeed = {
  sidonm: string;
  sggnm: string;
  dongName: string;
  officials: OfficialWithActivity[];
};

const ACTIVITY_LIMIT = 10;

export async function getRegionFeed(admCd: string): Promise<RegionFeed | null> {
  const region = await getElectedOfficialsByAdmCd(admCd);
  if (!region) return null;

  if (region.officials.length === 0) {
    return { ...region, officials: [] };
  }

  const routeIds = region.officials.map((o) => o.routeId);
  const politicians = await prisma.politician.findMany({
    where: { OR: [{ monaCd: { in: routeIds } }, { necId: { in: routeIds } }] },
    select: { id: true, monaCd: true, necId: true },
  });
  const polIdByRouteId = new Map<string, string>();
  for (const p of politicians) {
    if (p.monaCd && routeIds.includes(p.monaCd)) polIdByRouteId.set(p.monaCd, p.id);
    if (p.necId && routeIds.includes(p.necId)) polIdByRouteId.set(p.necId, p.id);
  }

  // 의원별로 bills/votes/asset 병렬 조회. 한 동네당 최대 4명이라 라운드트립 부담 적음.
  const polIds = [...new Set(polIdByRouteId.values())];
  const perPolitician = await Promise.all(
    polIds.map(async (pid) => {
      const [bills, votes, asset] = await Promise.all([
        prisma.bill.findMany({
          where: { politicianId: pid, proposedAt: { not: null } },
          orderBy: { proposedAt: "desc" },
          take: ACTIVITY_LIMIT,
        }),
        prisma.voteRecord.findMany({
          where: { politicianId: pid },
          orderBy: { voteDate: "desc" },
          take: ACTIVITY_LIMIT,
        }),
        prisma.asset.findFirst({
          where: { politicianId: pid },
          orderBy: { year: "desc" },
        }),
      ]);
      return { pid, bills, votes, asset };
    }),
  );
  const dataByPolId = new Map(perPolitician.map((d) => [d.pid, d]));

  const officials: OfficialWithActivity[] = region.officials.map((o) => {
    const pid = polIdByRouteId.get(o.routeId);
    const data = pid ? dataByPolId.get(pid) : undefined;

    const activities: OfficialActivity[] = [];
    if (data) {
      for (const b of data.bills) {
        if (!b.proposedAt) continue;
        activities.push({
          kind: "bill",
          id: `b-${b.id}`,
          at: b.proposedAt.toISOString(),
          billId: b.billId,
          billName: b.billName,
          billUrl: b.billUrl,
          summary: b.summary,
          billStatus: b.billStatus,
        });
      }
      for (const v of data.votes) {
        activities.push({
          kind: "vote",
          id: `v-${v.id}`,
          at: v.voteDate.toISOString(),
          billId: v.billId,
          billName: v.billName,
          billUrl: v.billUrl,
          result: v.result,
        });
      }
      activities.sort((a, b) => b.at.localeCompare(a.at));
    }

    return {
      ...o,
      activities: activities.slice(0, ACTIVITY_LIMIT),
      assetTotalKrw: data?.asset ? Number(data.asset.totalKrw) : null,
      assetYear: data?.asset?.year ?? null,
    };
  });

  return {
    sidonm: region.sidonm,
    sggnm: region.sggnm,
    dongName: region.dongName,
    officials,
  };
}
