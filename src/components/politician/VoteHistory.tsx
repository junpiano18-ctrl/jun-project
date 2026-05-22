import { splitBillName } from "@/lib/format/bill-name";

type VoteResult = "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT";

type VoteRecordRow = {
  id: string;
  billId: string;
  billName: string;
  voteDate: Date;
  result: VoteResult;
  billUrl: string | null;
  summary?: string | null; // Bill.summary join (AI 요약)
};

const RESULT_META: Record<
  VoteResult,
  {
    icon: string;
    label: string;
    badgeCls: string; // 결과 배지 색
    cardCls: string; // 카드 전체 강조 (찬성 외)
  }
> = {
  AGREE: {
    icon: "✅",
    label: "찬성",
    badgeCls: "bg-emerald-900/40 text-emerald-300",
    cardCls: "bg-zinc-900/60",
  },
  DISAGREE: {
    icon: "❌",
    label: "반대",
    badgeCls: "bg-red-900/50 text-red-200",
    cardCls: "bg-red-950/30 ring-1 ring-red-900/50",
  },
  ABSTAIN: {
    icon: "🟡",
    label: "기권",
    badgeCls: "bg-amber-900/50 text-amber-200",
    cardCls: "bg-amber-950/30 ring-1 ring-amber-900/50",
  },
  ABSENT: {
    icon: "⚫",
    label: "불참",
    badgeCls: "bg-zinc-800 text-zinc-400",
    cardCls: "bg-zinc-950/60 ring-1 ring-zinc-800",
  },
};

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function VoteHistory({ votes }: { votes: VoteRecordRow[] }) {
  if (votes.length === 0) return null;
  return (
    <ul className="space-y-2">
      {votes.map((v) => {
        const meta = RESULT_META[v.result];
        const { main, suffix } = splitBillName(v.billName);
        return (
          <li key={v.id} className={`rounded-lg p-3 ${meta.cardCls}`}>
            <div className="flex items-start gap-2.5">
              <span aria-hidden className="text-base leading-none">{meta.icon}</span>
              <div className="min-w-0 flex-1">
                {/* 법안명 */}
                {v.billUrl ? (
                  <a
                    href={v.billUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold leading-snug text-zinc-100 hover:text-white hover:underline"
                  >
                    {main}
                    {suffix && (
                      <span className="ml-1 text-[11px] font-normal text-zinc-500">
                        {suffix}
                      </span>
                    )}
                  </a>
                ) : (
                  <span className="text-sm font-semibold leading-snug text-zinc-100">
                    {main}
                    {suffix && (
                      <span className="ml-1 text-[11px] font-normal text-zinc-500">
                        {suffix}
                      </span>
                    )}
                  </span>
                )}

                {/* AI 요약 */}
                {v.summary && (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    💬 {v.summary}
                  </p>
                )}

                {/* 결과 + 날짜 */}
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                  <span className={`rounded-full px-1.5 py-0.5 font-semibold ${meta.badgeCls}`}>
                    {meta.label}
                  </span>
                  <span className="text-zinc-500">{fmtDate(v.voteDate)}</span>
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
