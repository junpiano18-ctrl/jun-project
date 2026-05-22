import type { WeeklyScheduleResult } from "@/lib/sources/assembly-schedule";

// 인터넷 의사중계 (공통 링크)
const LIVE_URL =
  "https://assembly.go.kr/portal/main/contents.do?menuNo=600054";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function fmtDate(iso: string): { md: string; dow: string } {
  const d = new Date(iso + "T00:00:00");
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return { md, dow: DOW[d.getDay()] };
}

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function stripHtml(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/<br\s*\/?>/gi, " · ").replace(/<[^>]+>/g, "").trim();
}

export function WeeklySchedule({ data, partyColor }: { data: WeeklyScheduleResult; partyColor: string }) {
  const all = [...data.plenary, ...data.committee].sort((a, b) =>
    `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`),
  );
  if (all.length === 0) return null;

  const today = todayIso();
  const hasToday = all.some((e) => e.date === today);

  return (
    <section className="rounded-xl p-5" style={{ backgroundColor: "#1a1a1a" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-400">이번 주 일정</h2>
        {hasToday && (
          <a
            href={LIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white hover:bg-red-500"
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE · 의사중계 보기
          </a>
        )}
      </div>
      <ul className="space-y-2">
        {all.map((e, i) => {
          const { md, dow } = fmtDate(e.date);
          const isToday = e.date === today;
          const subtitle =
            e.kind === "plenary"
              ? "본회의"
              : e.committeeName ?? "위원회";
          const agenda = stripHtml(e.agenda);
          return (
            <li
              key={`${e.date}-${e.kind}-${i}`}
              className={`rounded-lg px-3 py-2.5 ${
                isToday ? "bg-red-950/40 ring-1 ring-red-600/50" : "bg-zinc-900/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <span aria-hidden className="mt-0.5 text-base">
                  📅
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-white">
                      {md} ({dow})
                    </span>
                    {e.time && (
                      <span className="text-xs text-zinc-400">{e.time}</span>
                    )}
                    {isToday && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: partyColor, color: "#fff" }}
                      >
                        오늘
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm text-zinc-200">
                    {subtitle} · {e.title}
                  </div>
                  {agenda && (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                      {agenda}
                    </p>
                  )}
                  {e.link && (
                    <a
                      href={e.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[11px] font-medium text-zinc-400 hover:text-white"
                    >
                      → 일정 원문 보기
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-zinc-500">
        출처: 열린국회정보 · 본회의/위원회 의사일정
      </p>
    </section>
  );
}
