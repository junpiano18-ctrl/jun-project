import { prisma } from "@/lib/db";
import {
  REGION_CENTERS,
  regionKeyFor,
  type RegionKey,
} from "@/lib/geo/region-centers";

export type RegionMember = {
  monaCd: string;
  name: string;
  districtName: string;
  party: { name: string; color: string } | null;
};

export type RegionMembersResult = {
  key: RegionKey;
  fullName: string;
  members: RegionMember[];
};

export async function getRegionMembers(
  key: RegionKey,
): Promise<RegionMembersResult> {
  const rows = await prisma.politicianTerm.findMany({
    where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
    include: { politician: true, district: true, party: true },
    orderBy: { politician: { name: "asc" } },
  });

  const members: RegionMember[] = [];
  for (const r of rows) {
    if (regionKeyFor(r.district.name, r.district.isProportional) !== key) continue;
    if (!r.politician.monaCd) continue;
    members.push({
      monaCd: r.politician.monaCd,
      name: r.politician.name,
      districtName: r.district.name,
      party: r.party ? { name: r.party.name, color: r.party.color } : null,
    });
  }

  return { key, fullName: REGION_CENTERS[key].fullName, members };
}

export type ProportionalGroup = {
  partyName: string;
  partyColor: string;
  members: { monaCd: string; name: string }[];
};

export async function getProportionalMembers(): Promise<ProportionalGroup[]> {
  const rows = await prisma.politicianTerm.findMany({
    where: {
      term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
      electedAs: "PROPORTIONAL",
    },
    include: { politician: true, party: true },
    orderBy: { politician: { name: "asc" } },
  });

  const byParty = new Map<string, ProportionalGroup>();
  for (const r of rows) {
    if (!r.politician.monaCd) continue;
    const partyName = r.party?.name ?? "무소속";
    const partyColor = r.party?.color ?? "#888888";
    const group =
      byParty.get(partyName) ?? { partyName, partyColor, members: [] };
    group.members.push({ monaCd: r.politician.monaCd, name: r.politician.name });
    byParty.set(partyName, group);
  }
  return [...byParty.values()].sort((a, b) => b.members.length - a.members.length);
}

