// 열린국회 의사일정 API 클라이언트.
// - 본회의: open.assembly.go.kr/portal/openapi/nekcaiymatialqlxr (UNIT_CD=100022)
// - 위원회: open.assembly.go.kr/portal/openapi/nrsldhjpaemrmolla (UNIT_CD=100022)
// 두 응답 형식이 달라 별도 normalize.

const PLENARY_URL =
  "https://open.assembly.go.kr/portal/openapi/nekcaiymatialqlxr";
const COMMITTEE_URL =
  "https://open.assembly.go.kr/portal/openapi/nrsldhjpaemrmolla";
const UNIT_CD_22 = "100022";

export type ScheduleEntry = {
  date: string; // YYYY-MM-DD
  time: string | null; // "HH:MM" or "HHMM" — 그대로 보존, UI에서 정규화
  kind: "plenary" | "committee";
  title: string; // 회의명 (예: "전체회의", "법안심사소위원회")
  committeeName: string | null; // 위원회명 (본회의는 null)
  sessionLabel: string | null; // 예: "제435회국회(임시회) 제2차"
  link: string | null;
  agenda: string | null; // 안건 (HTML <br> 가능)
};

type PlenaryRow = {
  MEETINGSESSION?: string;
  CHA?: string;
  TITLE?: string;
  MEETTING_DATE?: string;
  MEETTING_TIME?: string;
  LINK_URL?: string;
  UNIT_CD?: string;
  CONTS?: string;
};

type CommitteeRow = {
  MEETING_DATE?: string;
  MEETING_TIME?: string;
  SESS?: string;
  DEGREE?: number | string;
  TITLE?: string;
  COMMITTEE_NAME?: string;
  LINK_URL2?: string;
  ANGUN?: string;
};

type Block = { head: { list_total_count?: number; RESULT?: { CODE: string; MESSAGE: string } }[] } | { row: unknown[] };

async function fetchAll<TRow>(
  endpoint: string,
  key: string,
  topName: string,
  pSize = 300,
): Promise<TRow[]> {
  const url = new URL(endpoint);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", String(pSize));
  url.searchParams.set("UNIT_CD", UNIT_CD_22);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 naemeosum/0.1" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  const result = json.RESULT as
    | { CODE?: string; MESSAGE?: string }
    | undefined;
  if (result && "CODE" in result) {
    if (result.CODE === "INFO-200") return []; // 데이터 없음
    throw new Error(`${result.CODE} ${result.MESSAGE ?? ""}`);
  }
  const blocks = json[topName] as Block[] | undefined;
  if (!blocks) return [];
  for (const b of blocks) {
    if ("row" in b) return b.row as TRow[];
  }
  return [];
}

function parseTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = t.trim();
  if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2)}`;
  return s; // 이미 HH:MM 형식
}

export async function getPlenarySchedules(): Promise<ScheduleEntry[]> {
  const key = process.env.OPEN_ASSEMBLY_SCHEDULE_KEY;
  if (!key) return [];
  const rows = await fetchAll<PlenaryRow>(PLENARY_URL, key, "nekcaiymatialqlxr");
  return rows
    .filter((r) => r.MEETTING_DATE)
    .map((r) => ({
      date: r.MEETTING_DATE!,
      time: parseTime(r.MEETTING_TIME),
      kind: "plenary" as const,
      title: r.TITLE ?? "본회의",
      committeeName: null,
      sessionLabel: r.MEETINGSESSION ? `${r.MEETINGSESSION} ${r.CHA ?? ""}`.trim() : null,
      link: r.LINK_URL ?? null,
      agenda: r.CONTS ?? null,
    }));
}

export async function getCommitteeSchedules(): Promise<ScheduleEntry[]> {
  const key = process.env.OPEN_ASSEMBLY_COMMITTEE_KEY;
  if (!key) return [];
  const rows = await fetchAll<CommitteeRow>(COMMITTEE_URL, key, "nrsldhjpaemrmolla");
  return rows
    .filter((r) => r.MEETING_DATE)
    .map((r) => ({
      date: r.MEETING_DATE!,
      time: parseTime(r.MEETING_TIME),
      kind: "committee" as const,
      title: r.TITLE ?? "회의",
      committeeName: r.COMMITTEE_NAME ?? null,
      sessionLabel: r.SESS ? `${r.SESS}${r.DEGREE ? ` 제${r.DEGREE}차` : ""}` : null,
      link: r.LINK_URL2 ?? null,
      agenda: r.ANGUN ?? null,
    }));
}

// 월요일 00:00 ~ 일요일 23:59:59 (KST 단순 계산: 서버 timezone 영향 받음 — 운영은 UTC+9 가정)
export function thisWeekRange(now = new Date()): { from: string; to: string } {
  const day = now.getDay(); // 0=일, 1=월
  const offsetToMonday = (day + 6) % 7; // 월=0, 일=6
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - offsetToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(monday), to: fmt(sunday) };
}

export type WeeklyScheduleResult = {
  range: { from: string; to: string };
  plenary: ScheduleEntry[]; // 이번 주 본회의
  committee: ScheduleEntry[]; // 이번 주 의원 소속 위원회
};

// 의원의 소속 위원회명 array (currentTerm.committees JSON에서) + ALLNAMEMBER fallback X.
// 정청래 → ["국방위원회"]. 없으면 [].
export async function getWeeklyScheduleFor(
  committeeNames: string[],
): Promise<WeeklyScheduleResult> {
  const { from, to } = thisWeekRange();
  const [plenary, committee] = await Promise.all([
    getPlenarySchedules().catch(() => []),
    getCommitteeSchedules().catch(() => []),
  ]);

  const inWeek = (d: string) => d >= from && d <= to;
  const matchCmt = (name: string | null) =>
    committeeNames.length === 0
      ? false
      : !!name && committeeNames.includes(name);

  const sortByDateTime = (a: ScheduleEntry, b: ScheduleEntry) => {
    const ad = `${a.date} ${a.time ?? ""}`;
    const bd = `${b.date} ${b.time ?? ""}`;
    return ad.localeCompare(bd);
  };

  return {
    range: { from, to },
    plenary: plenary.filter((e) => inWeek(e.date)).sort(sortByDateTime),
    committee: committee.filter((e) => inWeek(e.date) && matchCmt(e.committeeName)).sort(sortByDateTime),
  };
}
