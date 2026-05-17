import { prisma } from "@/lib/db";
import { REGION_CENTERS, regionKeyFor, type RegionKey } from "@/lib/geo/region-centers";

export type PartyTally = { name: string; color: string; count: number };

export type RegionSummary = {
  key: RegionKey;
  fullName: string;
  lat: number;
  lng: number;
  total: number;
  parties: PartyTally[];
};

export type RegionSummaryResult = {
  regions: RegionSummary[];
  proportionalTotal: number;
};

// 22대 국회의원 286명을 17개 광역 시·도로 집계 + 정당 분포.
// 비례대표는 별도 카운트로 분리.
export async function getRegionSummary(): Promise<RegionSummaryResult> {
  const rows = await prisma.politicianTerm.findMany({
    where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
    include: { district: true, party: true },
  });

  const buckets = new Map<RegionKey, Map<string, PartyTally>>();
  let proportional = 0;

  for (const r of rows) {
    const key = regionKeyFor(r.district.name, r.district.isProportional);
    if (!key) {
      if (r.district.isProportional) proportional++;
      continue;
    }
    const bucket = buckets.get(key) ?? new Map<string, PartyTally>();
    const partyName = r.party?.name ?? "무소속";
    const color = r.party?.color ?? "#888888";
    const cur = bucket.get(partyName) ?? { name: partyName, color, count: 0 };
    cur.count++;
    bucket.set(partyName, cur);
    buckets.set(key, bucket);
  }

  const regions: RegionSummary[] = (Object.keys(REGION_CENTERS) as RegionKey[]).map((key) => {
    const bucket = buckets.get(key);
    const parties = bucket ? [...bucket.values()].sort((a, b) => b.count - a.count) : [];
    const meta = REGION_CENTERS[key];
    return {
      key,
      fullName: meta.fullName,
      lat: meta.lat,
      lng: meta.lng,
      total: parties.reduce((acc, p) => acc + p.count, 0),
      parties,
    };
  });

  return { regions, proportionalTotal: proportional };
}
