import { prisma } from "@/lib/db";
import dongMapping from "@/lib/geo/dong-to-district.json";

type DongEntry = {
  adm_cd: string;
  adm_nm: string;
  sidonm: string;
  sggnm: string;
  dongName: string;
  districtSidoSgg: string;
  districtName: string | null;
};

export type OfficialPosition =
  | "NATIONAL_ASSEMBLY"
  | "METRO_GOVERNOR"
  | "EDUCATION_SUPERINTENDENT"
  | "LOCAL_GOVERNOR";

export type ElectedOfficial = {
  position: OfficialPosition;
  positionLabel: string; // "국회의원", "경기도지사", "고양시장", "경기도 교육감"
  routeId: string; // /politicians/[id] — monaCd ?? necId
  name: string;
  districtName: string;
  party: { name: string; color: string } | null;
  photoUrl: string | null;
  termEndDate: Date | null; // 임기 종료일 (D-day 계산용)
  // 본 직무 외 겸직 (예: 법무부장관). 없으면 null.
  additionalRole: string | null;
  // 국회의원 전용 팩트. 없으면 null.
  facts: {
    voteAttend: number | null;
    voteSession: number | null;
    billProposed: number | null;
  } | null;
};

export type RegionOfficialsResult = {
  admCd: string;
  sidonm: string;
  sggnm: string;
  dongName: string;
  officials: ElectedOfficial[];
};

// 행정구 포함된 sggnm("고양시덕양구")에서 자치단체 기반키("고양시") 추출.
// 행정구 없으면("마포구","이천시") 그대로 반환.
function municipalityKey(sggnm: string): string {
  const m = sggnm.match(/^(.+?[시군])[가-힣]+구$/);
  return m ? m[1] : sggnm;
}

// sidonm으로부터 광역단체장 호칭 결정.
// "경기도" → "경기도지사", "서울특별시" → "서울특별시장"
function metroGovTitle(sidonm: string): string {
  if (sidonm.endsWith("도")) return `${sidonm}지사`;
  if (sidonm.endsWith("시")) return `${sidonm}장`;
  return `${sidonm} 단체장`;
}

// LOCAL_GOVERNOR District.name(예: "경기도 고양시")에서 자치단체장 호칭.
// "마포구" → "마포구청장", "고양시" → "고양시장", "양평군" → "양평군수"
function localGovTitle(districtName: string): string {
  const last = districtName.split(" ").slice(-1)[0] ?? districtName;
  if (last.endsWith("구")) return `${last}청장`;
  if (last.endsWith("시")) return `${last}장`;
  if (last.endsWith("군")) return `${last.slice(0, -1)}군수`;
  return last;
}

export async function getElectedOfficialsByAdmCd(
  admCd: string,
): Promise<RegionOfficialsResult | null> {
  const entries = dongMapping as DongEntry[];
  const entry = entries.find((e) => e.adm_cd === admCd);
  if (!entry) return null;

  const naDistrictName = entry.districtName; // 이미 매핑된 22대 선거구명, null이면 공석
  const metroDistrictName = entry.sidonm; // METRO/EDU의 District.name
  const localDistrictName = `${entry.sidonm} ${municipalityKey(entry.sggnm)}`; // LOCAL의 District.name

  const [naRow, metroRow, eduRow, localRow] = await Promise.all([
    naDistrictName
      ? prisma.politicianTerm.findFirst({
          where: {
            term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
            district: {
              positionType: "NATIONAL_ASSEMBLY",
              name: naDistrictName,
            },
          },
          include: { politician: true, district: true, party: true, term: true },
        })
      : Promise.resolve(null),
    prisma.politicianTerm.findFirst({
      where: {
        term: { positionType: "METRO_GOVERNOR", number: 8 },
        district: { positionType: "METRO_GOVERNOR", name: metroDistrictName },
      },
      include: { politician: true, district: true, party: true, term: true },
    }),
    prisma.politicianTerm.findFirst({
      where: {
        term: { positionType: "EDUCATION_SUPERINTENDENT", number: 8 },
        district: {
          positionType: "EDUCATION_SUPERINTENDENT",
          name: metroDistrictName,
        },
      },
      include: { politician: true, district: true, party: true, term: true },
    }),
    prisma.politicianTerm.findFirst({
      where: {
        term: { positionType: "LOCAL_GOVERNOR", number: 8 },
        district: {
          positionType: "LOCAL_GOVERNOR",
          name: localDistrictName,
        },
      },
      include: { politician: true, district: true, party: true, term: true },
    }),
  ]);

  const officials: ElectedOfficial[] = [];

  if (naRow) {
    const routeId = naRow.politician.monaCd ?? naRow.politician.necId;
    if (routeId) {
      officials.push({
        position: "NATIONAL_ASSEMBLY",
        positionLabel: "국회의원",
        routeId,
        name: naRow.politician.name,
        districtName: naRow.district.name,
        party: naRow.party
          ? { name: naRow.party.name, color: naRow.party.color }
          : null,
        photoUrl: naRow.politician.photoUrl,
        additionalRole: naRow.additionalRole ?? null,
        termEndDate: naRow.term?.endDate ?? null,
        facts: {
          voteAttend: naRow.plenaryVoteAttendCount ?? null,
          voteSession: naRow.plenaryVoteSessionCount ?? null,
          billProposed: naRow.billProposedCount ?? null,
        },
      });
    }
  }

  if (metroRow) {
    const routeId = metroRow.politician.monaCd ?? metroRow.politician.necId;
    if (routeId) {
      officials.push({
        position: "METRO_GOVERNOR",
        positionLabel: metroGovTitle(metroRow.district.name),
        routeId,
        name: metroRow.politician.name,
        districtName: metroRow.district.name,
        party: metroRow.party
          ? { name: metroRow.party.name, color: metroRow.party.color }
          : null,
        photoUrl: metroRow.politician.photoUrl,
        additionalRole: metroRow.additionalRole ?? null,
        termEndDate: metroRow.term?.endDate ?? null,
        facts: null,
      });
    }
  }

  if (eduRow) {
    const routeId = eduRow.politician.monaCd ?? eduRow.politician.necId;
    if (routeId) {
      officials.push({
        position: "EDUCATION_SUPERINTENDENT",
        positionLabel: `${eduRow.district.name} 교육감`,
        routeId,
        name: eduRow.politician.name,
        districtName: eduRow.district.name,
        party: eduRow.party
          ? { name: eduRow.party.name, color: eduRow.party.color }
          : null,
        photoUrl: eduRow.politician.photoUrl,
        additionalRole: eduRow.additionalRole ?? null,
        termEndDate: eduRow.term?.endDate ?? null,
        facts: null,
      });
    }
  }

  if (localRow) {
    const routeId = localRow.politician.monaCd ?? localRow.politician.necId;
    if (routeId) {
      officials.push({
        position: "LOCAL_GOVERNOR",
        positionLabel: localGovTitle(localRow.district.name),
        routeId,
        name: localRow.politician.name,
        districtName: localRow.district.name,
        party: localRow.party
          ? { name: localRow.party.name, color: localRow.party.color }
          : null,
        photoUrl: localRow.politician.photoUrl,
        additionalRole: localRow.additionalRole ?? null,
        termEndDate: localRow.term?.endDate ?? null,
        facts: null,
      });
    }
  }

  return {
    admCd: entry.adm_cd,
    sidonm: entry.sidonm,
    sggnm: entry.sggnm,
    dongName: entry.dongName,
    officials,
  };
}
