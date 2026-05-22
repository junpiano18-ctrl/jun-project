import { splitBillName } from "@/lib/format/bill-name";

type VoteResult = "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT";

export type NotableVoteRow = {
  id: string;
  billId: string;
  billName: string;
  voteDate: Date;
  result: VoteResult;
  billUrl: string | null;
  summary: string | null;
  voteTcnt: number | null;
  yesTcnt: number | null;
  noTcnt: number | null;
  blankTcnt: number | null;
};

const MINE_LABEL: Record<VoteResult, { icon: string; label: string; cls: string }> = {
  AGREE:    { icon: "✅", label: "찬성했어요", cls: "text-emerald-300" },
  DISAGREE: { icon: "❌", label: "반대했어요", cls: "text-red-300" },
  ABSTAIN:  { icon: "🟡", label: "기권했어요", cls: "text-amber-300" },
  ABSENT:   { icon: "⚫", label: "불참했어요", cls: "text-zinc-500" },
};

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function NotableVotes({ votes }: { votes: NotableVoteRow[] }) {
  if (votes.length === 0) return null;
  return (
    <ul className="space-y-2.5">
      {votes.map((v) => {
        const { main, suffix } = splitBillName(v.billName);
        const yes = v.yesTcnt ?? 0;
        const no = v.noTcnt ?? 0;
        const blank = v.blankTcnt ?? 0;
        const total = v.voteTcnt ?? yes + no + blank;
        const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;
        const noPct = total > 0 ? Math.round((no / total) * 100) : 0;
        const blankPct = total > 0 ? Math.round((blank / total) * 100) : 0;
        const mine = MINE_LABEL[v.result];
        return (
          <li
            key={v.id}
            className="rounded-lg bg-zinc-900/60 p-3 ring-1 ring-amber-700/30"
          >
            {/* 법안명 + 의안링크 */}
            {v.billUrl ? (
              <a
                href={v.billUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-semibold leading-snug text-zinc-100 hover:text-white hover:underline"
              >
                {main}
                {suffix && (
                  <span className="ml-1 text-[11px] font-normal text-zinc-500">
                    {suffix}
                  </span>
                )}
              </a>
            ) : (
              <span className="block text-sm font-semibold leading-snug text-zinc-100">
                {main}
              </span>
            )}

            {/* AI 요약 */}
            {v.summary && (
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                💬 {v.summary}
              </p>
            )}

            {/* 전체 표결 분포 */}
            <div className="mt-2.5 overflow-hidden rounded-full bg-zinc-800/60">
              <div className="flex h-1.5 w-full">
                {yes > 0 && (
                  <div
                    className="bg-emerald-500/80"
                    style={{ width: `${yesPct}%` }}
                  />
                )}
                {no > 0 && (
                  <div
                    className="bg-red-500/80"
                    style={{ width: `${noPct}%` }}
                  />
                )}
                {blank > 0 && (
                  <div
                    className="bg-amber-500/70"
                    style={{ width: `${blankPct}%` }}
                  />
                )}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              <span className="text-emerald-300">찬성 {yes}명 ({yesPct}%)</span>
              <span className="text-zinc-600">·</span>
              <span className="text-red-300">반대 {no}명 ({noPct}%)</span>
              {blank > 0 && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-amber-300">기권 {blank}명</span>
                </>
              )}
            </div>

            {/* 이 의원 표결 */}
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
              <span aria-hidden>{mine.icon}</span>
              <span className="text-zinc-400">이 의원:</span>
              <span className={mine.cls}>{mine.label}</span>
              <span className="ml-auto text-[11px] font-normal text-zinc-500">
                {fmtDate(v.voteDate)}
              </span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
