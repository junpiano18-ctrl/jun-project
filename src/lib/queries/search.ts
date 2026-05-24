import { prisma } from "@/lib/db";
import dongMapping from "@/lib/geo/dong-to-district.json";

export type SearchPoliticianResult = {
  routeId: string; // monaCd(국회의원) 또는 necId(단체장·교육감). 정치인 상세/지도 focus 키.
  name: string;
  districtName: string;
  positionTitle: string; // "국회의원" / "시·도지사" / "교육감" / "시·군·구청장"
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

// 법안명 키워드 검색. 22대 한정. take 6개로 제한.
// Bill(의원 발의) + PlenaryBill(본회의 처리 안건 — 대안·위원회안 포함) 둘 다 검색해서 합침.
// 같은 billId가 양쪽에 있으면 Bill(발의자 메타 있는 쪽) 우선.
export async function searchBillsByKeyword(q: string): Promise<SearchBillResult[]> {
  const query = q.trim();
  if (query.length < 2) return []; // 1자는 노이즈 — 2자 이상만

  const TAKE = 6;

  const [billRows, plenaryRows] = await Promise.all([
    prisma.bill.findMany({
      where: { billName: { contains: query } },
      orderBy: { proposedAt: "desc" },
      take: TAKE,
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
    }),
    prisma.plenaryBill.findMany({
      where: { billName: { contains: query } },
      orderBy: { procDate: "desc" },
      take: TAKE,
      select: {
        billId: true,
        billName: true,
        billUrl: true,
        summary: true,
        procDate: true,
        voteTcnt: true,
        yesTcnt: true,
        noTcnt: true,
      },
    }),
  ]);

  // Bill을 우선 채우고, PlenaryBill 중 같은 billId 아닌 것만 추가.
  const seen = new Set<string>();
  const out: SearchBillResult[] = [];

  for (const b of billRows) {
    if (seen.has(b.billId)) continue;
    seen.add(b.billId);
    const term = b.politician.terms[0];
    out.push({
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
    });
  }

  for (const p of plenaryRows) {
    if (seen.has(p.billId)) continue;
    if (out.length >= TAKE) break;
    seen.add(p.billId);
    // PlenaryBill에는 발의자(politician) 정보 없음. 표결 결과로 상태 추정.
    const status: SearchBillResult["billStatus"] =
      p.voteTcnt && p.yesTcnt && p.noTcnt !== null && p.yesTcnt > p.noTcnt
        ? "PASSED"
        : "REJECTED";
    out.push({
      billId: p.billId,
      billName: p.billName,
      billUrl: p.billUrl ?? "",
      summary: p.summary,
      billStatus: status,
      proposedAt: p.procDate ? p.procDate.toISOString() : null,
      politician: null,
    });
  }

  return out.slice(0, TAKE);
}

// 22대 국회의원 + 8회 광역단체장·교육감·기초단체장 이름 부분 일치 검색.
// 정확 일치 > 시작 일치 > 포함 일치 우선순위, 최대 5명.
// 한 사람이 여러 임기에 등록되어 있어도 routeId 단위로 dedupe (NA 22대 우선).
export async function searchPoliticiansByName(q: string): Promise<SearchPoliticianResult[]> {
  const query = q.trim();
  if (query.length < 1) return [];

  // 후보를 넉넉히 가져온 뒤 자바스크립트로 정렬 (DB는 contains만).
  // 4개 직급(현 임기) 모두 포함.
  const rows = await prisma.politicianTerm.findMany({
    where: {
      OR: [
        { term: { positionType: "NATIONAL_ASSEMBLY", number: 22 } },
        { term: { positionType: "METRO_GOVERNOR", number: 8 } },
        { term: { positionType: "EDUCATION_SUPERINTENDENT", number: 8 } },
        { term: { positionType: "LOCAL_GOVERNOR", number: 8 } },
      ],
      politician: { name: { contains: query } },
    },
    include: { politician: true, district: true, party: true, term: true },
    take: 40,
    orderBy: { politician: { name: "asc" } },
  });

  // 같은 정치인이 여러 임기에 걸쳐 있을 수 있음. routeId 첫 등장만 유지하되,
  // 우선순위는 NA 22대 > 단체장/교육감 8회 (현직 국회의원이 우선 표시되도록).
  const priorityOf = (positionType: string): number =>
    positionType === "NATIONAL_ASSEMBLY" ? 0 : 1;
  const seen = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    const routeId = r.politician.monaCd ?? r.politician.necId;
    if (!routeId) continue;
    const existing = seen.get(routeId);
    if (
      !existing ||
      priorityOf(r.term.positionType) < priorityOf(existing.term.positionType)
    ) {
      seen.set(routeId, r);
    }
  }

  const ranked = [...seen.values()]
    .map((r) => {
      const name = r.politician.name;
      let rank = 2;
      if (name === query) rank = 0;
      else if (name.startsWith(query)) rank = 1;
      return { r, rank };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank || a.r.politician.name.localeCompare(b.r.politician.name, "ko"),
    )
    .slice(0, 5);

  return ranked.map(({ r }) => ({
    routeId: (r.politician.monaCd ?? r.politician.necId) as string,
    name: r.politician.name,
    districtName: r.district.name,
    positionTitle: r.positionTitle,
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
    // region 검색 결과는 지역구 NA만 매핑되므로 routeId == monaCd.
    const politician =
      t && t.politician.monaCd
        ? {
            routeId: t.politician.monaCd,
            name: t.politician.name,
            districtName: t.district.name,
            positionTitle: t.positionTitle,
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
