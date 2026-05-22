import Link from "next/link";
import { PoliticianPhoto } from "@/components/politician/PoliticianPhoto";
import type { ElectedOfficial } from "@/lib/queries/region-officials";

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  if (ms < 0) return null;
  return Math.floor(ms / 86400000);
}

export function OfficialSlim({ official }: { official: ElectedOfficial }) {
  const partyColor = official.party?.color ?? "#a1a1aa";
  const dDay = daysUntil(official.termEndDate);

  return (
    <Link
      href={`/politicians/${official.routeId}`}
      className="group flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex items-center gap-3">
        <PoliticianPhoto
          name={official.name}
          partyColor={partyColor}
          photoUrl={official.photoUrl}
          size={44}
          shape="circle"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">
              {official.name}
            </span>
            {official.additionalRole && (
              <span
                className="rounded-full px-1.5 py-px text-[9px] font-semibold text-white"
                style={{ backgroundColor: "#CA8A04" }}
                title="현재 겸직"
              >
                +{official.additionalRole}
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-zinc-500">
            {official.positionLabel}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        {dDay !== null ? (
          <span className="text-zinc-500">
            임기 <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">D-{dDay}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="font-medium text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
          자세히 →
        </span>
      </div>
    </Link>
  );
}
