import type { PartyTally } from "@/lib/queries/bills";

export function PartyTallyTable({ tallies }: { tallies: PartyTally[] }) {
  if (tallies.length === 0) {
    return (
      <p className="text-sm text-zinc-500">표결 정보가 없어요.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {tallies.map((t) => {
        const total = t.total;
        const yesPct = total > 0 ? (t.agree / total) * 100 : 0;
        const noPct = total > 0 ? (t.disagree / total) * 100 : 0;
        const absPct = total > 0 ? (t.abstain / total) * 100 : 0;
        const absentPct = total > 0 ? (t.absent / total) * 100 : 0;
        return (
          <li key={t.partyName}>
            <div className="mb-1.5 flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ backgroundColor: t.partyColor }}
              />
              <span className="font-semibold text-zinc-900">{t.partyName}</span>
              <span className="text-xs text-zinc-500">총 {total}명</span>
            </div>
            <div className="overflow-hidden rounded-full bg-zinc-100">
              <div className="flex h-2 w-full">
                {t.agree > 0 && (
                  <div className="bg-emerald-500" style={{ width: `${yesPct}%` }} />
                )}
                {t.disagree > 0 && (
                  <div className="bg-red-500" style={{ width: `${noPct}%` }} />
                )}
                {t.abstain > 0 && (
                  <div className="bg-amber-500" style={{ width: `${absPct}%` }} />
                )}
                {t.absent > 0 && (
                  <div className="bg-zinc-400" style={{ width: `${absentPct}%` }} />
                )}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
              {t.agree > 0 && <span className="text-emerald-700">찬성 {t.agree}</span>}
              {t.disagree > 0 && (
                <>
                  {t.agree > 0 && <span className="text-zinc-300">·</span>}
                  <span className="text-red-700">반대 {t.disagree}</span>
                </>
              )}
              {t.abstain > 0 && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span className="text-amber-700">기권 {t.abstain}</span>
                </>
              )}
              {t.absent > 0 && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span className="text-zinc-500">불참 {t.absent}</span>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
