// 열린국회정보 (open.assembly.go.kr) 클라이언트.
//
// 주의: 이 API는 User-Agent 헤더가 없으면 무조건 400 Bad Request로 응답한다.
// (KEY 유효성 검증보다 먼저 차단됨)
//
// 인증키는 OPEN_ASSEMBLY_API_KEY 환경변수로 받는다. 응답은 JSON(Type=json).
// API 카탈로그: https://open.assembly.go.kr/portal/data/service/selectAPIServicePage.do

const BASE_URL = "https://open.assembly.go.kr/portal/openapi";
const USER_AGENT = "politics-map/0.1 (+contact: junpiano18@gmail.com)";

export type OpenAssemblyResponse<T> = {
  rows: T[];
  totalCount: number;
};

type RawResponse = Record<string, unknown>;

function getKey(): string {
  const key = process.env.OPEN_ASSEMBLY_API_KEY;
  if (!key) throw new Error("OPEN_ASSEMBLY_API_KEY is not set");
  return key;
}

// 응답 형식: { <serviceId>: [{ head: [{list_total_count}, {RESULT}] }, { row: [...] }] }
function unwrap<T>(serviceId: string, payload: RawResponse): OpenAssemblyResponse<T> {
  const block = payload[serviceId];
  if (!Array.isArray(block)) {
    throw new Error(
      `Unexpected response from ${serviceId}: ${JSON.stringify(payload).slice(0, 300)}`,
    );
  }
  const headBlock = block.find((b) => Array.isArray((b as RawResponse)?.head)) as
    | { head: Array<{ list_total_count?: number; RESULT?: { CODE: string; MESSAGE: string } }> }
    | undefined;
  const rowBlock = block.find((b) => Array.isArray((b as RawResponse)?.row)) as
    | { row: T[] }
    | undefined;

  const result = headBlock?.head.find((h) => h.RESULT)?.RESULT;
  if (result && result.CODE !== "INFO-000") {
    throw new Error(`open-assembly ${serviceId} error: ${result.CODE} ${result.MESSAGE}`);
  }

  return {
    rows: rowBlock?.row ?? [],
    totalCount: headBlock?.head.find((h) => h.list_total_count != null)?.list_total_count ?? 0,
  };
}

async function call<T>(
  serviceId: string,
  params: Record<string, string | number> = {},
): Promise<OpenAssemblyResponse<T>> {
  const url = new URL(`${BASE_URL}/${serviceId}`);
  url.searchParams.set("KEY", getKey());
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", String(params.pIndex ?? 1));
  url.searchParams.set("pSize", String(params.pSize ?? 100));
  for (const [k, v] of Object.entries(params)) {
    if (k === "pIndex" || k === "pSize") continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`open-assembly ${serviceId} failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as RawResponse;
  return unwrap<T>(serviceId, json);
}

// 22대 현역 국회의원 명단. (총 ~286명. 사퇴·궐석으로 정원 300에 못 미침)
// service id: nwvrqwxyaytdsfvhu
export type AssemblyMemberRow = {
  HG_NM: string; // 한글 이름
  HJ_NM: string | null; // 한자
  ENG_NM: string | null; // 영문
  BTH_DATE: string | null; // 생년월일 (YYYY-MM-DD)
  BTH_GBN_NM: string | null; // 음/양
  SEX_GBN_NM: string | null; // 성별
  POLY_NM: string | null; // 정당명
  ORIG_NM: string | null; // 선거구명 (예: "서울 종로구", "비례대표")
  ELECT_GBN_NM: string | null; // "지역구" | "비례대표"
  CMIT_NM: string | null; // 소속 위원회 (대표 1개)
  CMITS: string | null; // 소속 위원회 전체 (콤마 구분)
  REELE_GBN_NM: string | null; // "초선" | "재선" | ...
  UNITS: string | null; // 당선 대수 (예: "제21대, 제22대")
  TEL_NO: string | null;
  E_MAIL: string | null;
  HOMEPAGE: string | null;
  STAFF: string | null;
  SECRETARY: string | null;
  SECRETARY2: string | null;
  MONA_CD: string; // 의원 고유 코드 (다른 API들의 키)
  MEM_TITLE: string | null; // 경력 (긴 텍스트)
  ASSEM_ADDR: string | null; // 의원회관 호실
  JOB_RES_NM: string | null; // 위원회 내 직책 (위원/간사/위원장 등)
};

export function fetchCurrentAssemblyMembers(
  pIndex = 1,
  pSize = 300,
): Promise<OpenAssemblyResponse<AssemblyMemberRow>> {
  return call<AssemblyMemberRow>("nwvrqwxyaytdsfvhu", { pIndex, pSize });
}
