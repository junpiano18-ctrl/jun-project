import { prisma } from "@/lib/db";
import { getElectedOfficialsByAdmCd, type ElectedOfficial } from "@/lib/queries/region-officials";

export type FeedItem =
  | {
      kind: "bill";
      id: string;
      at: Date;
      official: ElectedOfficial;
      billId: string;
      billName: string;
      billUrl: string;
      summary: string | null; // AI 요약
      billStatus: "PENDING" | "PASSED" | "REJECTED";
    }
  | {
      kind: "vote";
      id: string;
      at: Date;
      official: ElectedOfficial;
      billId: string;
      billName: string;
      billUrl: string | null;
      result: "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT";
    };

export type RegionFeed = {
  sidonm: string;
  sggnm: string;
  dongName: string;
  officials: ElectedOfficial[];
  feed: FeedItem[];
};

const FEED_WINDOW_DAYS = 30;

export async function getRegionFeed(admCd: string): Promise<RegionFeed | null> {
  const region = await getElectedOfficialsByAdmCd(admCd);
  if (!region) return null;

  // 활동 데이터가 있는 직급은 현재 NA(국회의원)만. 다른 직급도 잡아두면 향후 데이터 채우면 자동 노출.
  const routeIds = region.officials.map((o) => o.routeId);
  if (routeIds.length === 0) {
    return { ...region, feed: [] };
  }

  // routeId(monaCd ?? necId) → Politician.id 매핑
  const politicians = await prisma.politician.findMany({
    where: {
      OR: [{ monaCd: { in: routeIds } }, { necId: { in: routeIds } }],
    },
    select: { id: true, monaCd: true, necId: true },
  });
  const polIdByRouteId = new Map<string, string>();
  for (const p of politicians) {
    if (p.monaCd && routeIds.includes(p.monaCd)) polIdByRouteId.set(p.monaCd, p.id);
    if (p.necId && routeIds.includes(p.necId)) polIdByRouteId.set(p.necId, p.id);
  }
  const polIds = [...new Set(polIdByRouteId.values())];
  const officialByPolId = new Map<string, ElectedOfficial>();
  for (const o of region.officials) {
    const pid = polIdByRouteId.get(o.routeId);
    if (pid) officialByPolId.set(pid, o);
  }

  const since = new Date();
  since.setDate(since.getDate() - FEED_WINDOW_DAYS);

  const [bills, votes] = await Promise.all([
    prisma.bill.findMany({
      where: { politicianId: { in: polIds }, proposedAt: { gte: since } },
      orderBy: { proposedAt: "desc" },
      take: 50,
    }),
    prisma.voteRecord.findMany({
      where: { politicianId: { in: polIds }, voteDate: { gte: since } },
      orderBy: { voteDate: "desc" },
      take: 50,
    }),
  ]);

  const feed: FeedItem[] = [];
  for (const b of bills) {
    const o = officialByPolId.get(b.politicianId);
    if (!o || !b.proposedAt) continue;
    feed.push({
      kind: "bill",
      id: `b-${b.id}`,
      at: b.proposedAt,
      official: o,
      billId: b.billId,
      billName: b.billName,
      billUrl: b.billUrl,
      summary: b.summary,
      billStatus: b.billStatus,
    });
  }
  for (const v of votes) {
    const o = officialByPolId.get(v.politicianId);
    if (!o) continue;
    feed.push({
      kind: "vote",
      id: `v-${v.id}`,
      at: v.voteDate,
      official: o,
      billId: v.billId,
      billName: v.billName,
      billUrl: v.billUrl,
      result: v.result,
    });
  }
  feed.sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    sidonm: region.sidonm,
    sggnm: region.sggnm,
    dongName: region.dongName,
    officials: region.officials,
    feed: feed.slice(0, 40),
  };
}
