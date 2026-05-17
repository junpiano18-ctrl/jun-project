import { prisma } from "@/lib/db";
import type { LayerKey } from "@/lib/map/layers";

export type PoliticianTermStatus = "ACTIVE" | "DISMISSED" | "SUSPENDED" | "DECEASED";

export type PoliticianPin = {
  routeId: string; // /politicians/[id]의 id. monaCd 우선, 없으면 necId
  name: string;
  districtName: string;
  positionTitle: string;
  layer: LayerKey;
  lat: number;
  lng: number;
  photoUrl: string | null;
  party: { name: string; color: string; shortName: string | null } | null;
  status: PoliticianTermStatus;
  // 팝업 카드 팩트
  attendanceAttend: number | null;
  attendanceSession: number | null;
  billProposed: number | null;
  assetTotalKrw: number | null; // 천원 단위
  termEndDate: string | null; // ISO date
};

// 4개 직급의 핀을 한 번에 모아 반환. layer 키로 KoreaMap에서 토글 필터.
//   national    — 22대 국회의원 지역구
//   metroGov    — 8회 광역단체장
//   edu         — 8회 교육감
//   localGov    — 8회 기초단체장
//
// 비례대표(국회의원)는 좌표 없어서 핀 제외, 별도 카운트로 반환.
export async function getPoliticianPins(): Promise<{
  pins: PoliticianPin[];
  proportionalTotal: number;
  missingCoords: number;
}> {
  const [nationalRows, metroGovRows, eduRows, localGovRows, propCount] =
    await Promise.all([
      prisma.politicianTerm.findMany({
        where: {
          term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
          electedAs: "CONSTITUENCY",
        },
        include: {
          politician: { include: { assets: { orderBy: { year: "desc" }, take: 1 } } },
          district: true,
          party: true,
          term: true,
        },
      }),
      prisma.politicianTerm.findMany({
        where: { term: { positionType: "METRO_GOVERNOR", number: 8 } },
        include: {
          politician: { include: { assets: { orderBy: { year: "desc" }, take: 1 } } },
          district: true,
          party: true,
          term: true,
        },
      }),
      prisma.politicianTerm.findMany({
        where: { term: { positionType: "EDUCATION_SUPERINTENDENT", number: 8 } },
        include: {
          politician: { include: { assets: { orderBy: { year: "desc" }, take: 1 } } },
          district: true,
          party: true,
          term: true,
        },
      }),
      prisma.politicianTerm.findMany({
        where: { term: { positionType: "LOCAL_GOVERNOR", number: 8 } },
        include: {
          politician: { include: { assets: { orderBy: { year: "desc" }, take: 1 } } },
          district: true,
          party: true,
          term: true,
        },
      }),
      prisma.politicianTerm.count({
        where: {
          term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
          electedAs: "PROPORTIONAL",
        },
      }),
    ]);

  const pins: PoliticianPin[] = [];
  let missing = 0;

  const collect = (
    rows: typeof nationalRows,
    layer: LayerKey,
  ) => {
    for (const r of rows) {
      if (r.district.centerLat === null || r.district.centerLng === null) {
        missing++;
        continue;
      }
      const routeId = r.politician.monaCd ?? r.politician.necId;
      if (!routeId) { missing++; continue; }
      const latestAsset = r.politician.assets?.[0] ?? null;
      pins.push({
        routeId,
        name: r.politician.name,
        districtName: r.district.name,
        positionTitle: r.positionTitle,
        layer,
        lat: r.district.centerLat,
        lng: r.district.centerLng,
        photoUrl: r.politician.photoUrl,
        party: r.party
          ? { name: r.party.name, color: r.party.color, shortName: r.party.shortName }
          : null,
        // r.status가 undefined인 케이스(dev 서버 prisma client 캐시 미반영 등) 안전 fallback.
        status: ((r.status as PoliticianTermStatus | undefined) ?? "ACTIVE") as PoliticianTermStatus,
        // dev server prisma client 캐시 stale일 때 undefined 올 수 있어 ?? null로 강제 정규화.
        attendanceAttend: r.plenaryVoteAttendCount ?? null,
        attendanceSession: r.plenaryVoteSessionCount ?? null,
        billProposed: r.billProposedCount ?? null,
        assetTotalKrw: latestAsset ? Number(latestAsset.totalKrw) : null,
        termEndDate: r.term?.endDate ? r.term.endDate.toISOString() : null,
      });
    }
  };

  collect(nationalRows, "national");
  collect(metroGovRows, "metroGov");
  collect(eduRows, "edu");
  collect(localGovRows, "localGov");

  return { pins, proportionalTotal: propCount, missingCoords: missing };
}
