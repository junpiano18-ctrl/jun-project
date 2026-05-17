import { prisma } from "@/lib/db";
import dongMapping from "@/lib/geo/dong-to-district.json";

export type SearchPoliticianResult = {
  monaCd: string;
  name: string;
  districtName: string;
  isProportional: boolean;
  party: { name: string; color: string } | null;
};

export type SearchRegionResult = {
  admNm: string; // "서울특별시 마포구 합정동"
  sidonm: string;
  sggnm: string;
  dongName: string;
  districtName: string; // DB District.name 또는 GeoJSON SIDO_SGG (공석)
  politician: SearchPoliticianResult | null;
};

type DongEntry = {
  adm_cd: string;
  adm_nm: string;
  sidonm: string;
  sggnm: string;
  dongName: string;
  districtSidoSgg: string;
  districtName: string | null;
};

// 22대 의원 이름 부분 일치 검색. take 8개로 제한.
export async function searchPoliticiansByName(q: string): Promise<SearchPoliticianResult[]> {
  const query = q.trim();
  if (query.length < 1) return [];

  const rows = await prisma.politicianTerm.findMany({
    where: {
      term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
      politician: { name: { contains: query } },
    },
    include: { politician: true, district: true, party: true },
    take: 8,
    orderBy: { politician: { name: "asc" } },
  });

  const out: SearchPoliticianResult[] = [];
  for (const r of rows) {
    if (!r.politician.monaCd) continue;
    out.push({
      monaCd: r.politician.monaCd,
      name: r.politician.name,
      districtName: r.district.name,
      isProportional: r.district.isProportional,
      party: r.party ? { name: r.party.name, color: r.party.color } : null,
    });
  }
  return out;
}

// 동/시·군·구 부분 일치 검색. 행정동 매핑 → 22대 선거구 → 해당 의원.
export async function searchByRegion(q: string): Promise<SearchRegionResult[]> {
  const query = q.trim();
  if (query.length < 1) return [];

  const entries = dongMapping as DongEntry[];

  // 정확도 우선: dongName 정확 일치 > dongName 부분 일치 > adm_nm/sggnm 부분 일치.
  const exact: DongEntry[] = [];
  const startsWith: DongEntry[] = [];
  const contains: DongEntry[] = [];
  for (const e of entries) {
    if (e.dongName === query) exact.push(e);
    else if (e.dongName.startsWith(query)) startsWith.push(e);
    else if (e.adm_nm.includes(query) || e.sggnm.includes(query)) contains.push(e);
  }
  const picked = [...exact, ...startsWith, ...contains].slice(0, 8);
  if (!picked.length) return [];

  // 매칭된 District.name 모아서 한 번에 의원 조회.
  const districtNames = [...new Set(picked.map((p) => p.districtName).filter(Boolean))] as string[];
  const terms = districtNames.length
    ? await prisma.politicianTerm.findMany({
        where: {
          term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
          district: { name: { in: districtNames } },
        },
        include: { politician: true, district: true, party: true },
      })
    : [];
  const politicianByDistrict = new Map<string, (typeof terms)[number]>();
  for (const t of terms) politicianByDistrict.set(t.district.name, t);

  return picked.map((e) => {
    const t = e.districtName ? politicianByDistrict.get(e.districtName) : undefined;
    const politician =
      t && t.politician.monaCd
        ? {
            monaCd: t.politician.monaCd,
            name: t.politician.name,
            districtName: t.district.name,
            isProportional: t.district.isProportional,
            party: t.party ? { name: t.party.name, color: t.party.color } : null,
          }
        : null;
    return {
      admNm: e.adm_nm,
      sidonm: e.sidonm,
      sggnm: e.sggnm,
      dongName: e.dongName,
      districtName: e.districtName ?? e.districtSidoSgg,
      politician,
    };
  });
}
