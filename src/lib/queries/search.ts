import { prisma } from "@/lib/db";
import dongMapping from "@/lib/geo/dong-to-district.json";

export type SearchPoliticianResult = {
  monaCd: string;
  name: string;
  districtName: string;
  isProportional: boolean;
  party: { name: string; color: string } | null;
};

export type SearchBillResult = {
  billId: string;
  billName: string;
  billUrl: string;
  summary: string | null;
  billStatus: "PENDING" | "PASSED" | "REJECTED";
  proposedAt: string | null; // ISO date
  politician: {
    monaCd: string | null;
    name: string;
    party: { name: string; color: string } | null;
  } | null;
};

export type SearchRegionResult = {
  admCd: string; // 8자리 행정동 코드
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 구/시/군 검색에서 선거구별 1건씩 라운드로빈으로 다양화.
// "마포구" → 갑·을, "고양시" → 갑·을·병·정 균등 노출. districtName null도 별도 버킷.
function diversifyByDistrict(entries: DongEntry[], cap: number): DongEntry[] {
  if (entries.length <= cap) return entries;
  const buckets = new Map<string, DongEntry[]>();
  for (const e of entries) {
    const key = e.districtName ?? "_null";
    const arr = buckets.get(key) ?? [];
    arr.push(e);
    buckets.set(key, arr);
  }
  const queues = [...buckets.values()];
  const out: DongEntry[] = [];
  while (out.length < cap && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      if (q.length === 0) continue;
      out.push(q.shift()!);
      if (out.length >= cap) break;
    }
  }
  return out;
}

// 법안명 키워드 검색. take 6개로 제한. 22대 한정.
export async function searchBillsByKeyword(q: string): Promise<SearchBillResult[]> {
  const query = q.trim();
  if (query.length < 2) return []; // 1자는 노이즈 — 2자 이상만

  const rows = await prisma.bill.findMany({
    where: { billName: { contains: query } },
    orderBy: { proposedAt: "desc" },
    take: 6,
    include: {
      politician: {
        select: {
          monaCd: true,
          name: true,
          terms: {
            where: { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
            include: { party: true },
            take: 1,
          },
        },
      },
    },
  });

  return rows.map((b) => {
    const term = b.politician.terms[0];
    return {
      billId: b.billId,
      billName: b.billName,
      billUrl: b.billUrl,
      summary: b.summary,
      billStatus: b.billStatus,
      proposedAt: b.proposedAt ? b.proposedAt.toISOString() : null,
      politician: {
        monaCd: b.politician.monaCd,
        name: b.politician.name,
        party: term?.party
          ? { name: term.party.name, color: term.party.color }
          : null,
      },
    };
  });
}

// 22대 의원 이름 부분 일치 검색. 정확 일치 > 시작 일치 > 포함 일치 우선순위, 최대 5명.
export async function searchPoliticiansByName(q: string): Promise<SearchPoliticianResult[]> {
  const query = q.trim();
  if (query.length < 1) return [];

  // 후보를 넉넉히 가져온 뒤 자바스크립트로 정렬 (DB는 contains만).
  const rows = await prisma.politicianTerm.findMany({
    where: {
      term: { positionType: "NATIONAL_ASSEMBLY", number: 22 },
      politician: { name: { contains: query } },
    },
    include: { politician: true, district: true, party: true },
    take: 20,
    orderBy: { politician: { name: "asc" } },
  });

  const ranked = rows
    .filter((r) => r.politician.monaCd)
    .map((r) => {
      const name = r.politician.name;
      let rank = 2;
      if (name === query) rank = 0;
      else if (name.startsWith(query)) rank = 1;
      return { r, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.r.politician.name.localeCompare(b.r.politician.name, "ko"))
    .slice(0, 5);

  return ranked.map(({ r }) => ({
    monaCd: r.politician.monaCd as string,
    name: r.politician.name,
    districtName: r.district.name,
    isProportional: r.district.isProportional,
    party: r.party ? { name: r.party.name, color: r.party.color } : null,
  }));
}

// 동/시·군·구 부분 일치 검색. 행정동 매핑 → 22대 선거구 → 해당 의원.
export async function searchByRegion(q: string): Promise<SearchRegionResult[]> {
  const query = q.trim();
  if (query.length < 1) return [];

  const entries = dongMapping as DongEntry[];

  // "성산동"처럼 동/읍/면 suffix로 끝나는 query는 숫자로 분할된 동도 함께 매칭
  // (예: "성산동" → "성산1동"·"성산2동"·"성산제1동"). placeholder가 "XX동" 형태라 사용자가
  // 그대로 따라 입력하는 케이스가 빈 결과를 내던 버그 보정.
  const suffix = query.slice(-1);
  const numberedDongPattern =
    query.length >= 2 && (suffix === "동" || suffix === "읍" || suffix === "면")
      ? new RegExp(`^${escapeRegExp(query.slice(0, -1))}(제)?\\d+${suffix}$`)
      : null;

  // "마포구"·"고양시"·"양평군" — sggnm 매칭. 행정구 분할된 시("고양시" → "고양시덕양구" 등)는
  // startsWith로 흡수. sgg 검색은 한도를 8로 늘리고 선거구별 라운드로빈으로 갑/을/병/정을 골고루 노출.
  const isSggQuery =
    query.length >= 2 && (suffix === "구" || suffix === "시" || suffix === "군");

  // 정확도 우선: 정확 일치 > 숫자 분할 동 > dongName 부분 일치 > sgg 매칭 > adm_nm/sggnm 부분 일치.
  const exact: DongEntry[] = [];
  const numbered: DongEntry[] = [];
  const startsWith: DongEntry[] = [];
  const sggMatch: DongEntry[] = [];
  const contains: DongEntry[] = [];
  for (const e of entries) {
    if (e.dongName === query) exact.push(e);
    else if (numberedDongPattern && numberedDongPattern.test(e.dongName)) numbered.push(e);
    else if (e.dongName.startsWith(query)) startsWith.push(e);
    else if (isSggQuery && (e.sggnm === query || e.sggnm.startsWith(query))) sggMatch.push(e);
    else if (e.adm_nm.includes(query) || e.sggnm.includes(query)) contains.push(e);
  }
  const cap = isSggQuery && sggMatch.length > 0 ? 8 : 5;
  const picked = [
    ...exact,
    ...numbered,
    ...startsWith,
    ...diversifyByDistrict(sggMatch, cap),
    ...contains,
  ].slice(0, cap);
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
      admCd: e.adm_cd,
      admNm: e.adm_nm,
      sidonm: e.sidonm,
      sggnm: e.sggnm,
      dongName: e.dongName,
      districtName: e.districtName ?? e.districtSidoSgg,
      politician,
    };
  });
}
