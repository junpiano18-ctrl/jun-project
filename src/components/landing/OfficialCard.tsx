import Link from "next/link";
import { PoliticianPhoto } from "@/components/politician/PoliticianPhoto";
import { FavoriteStar } from "@/components/favorites/FavoriteStar";
import type { ElectedOfficial } from "@/lib/queries/region-officials";

export function OfficialCard({ official }: { official: ElectedOfficial }) {
  const partyColor = official.party?.color ?? "#a1a1aa";

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div
        aria-hidden
        className="h-1.5 w-full"
        style={{ backgroundColor: partyColor }}
      />
      <div className="flex gap-4 p-4 sm:p-5">
        <PoliticianPhoto
          name={official.name}
          partyColor={partyColor}
          photoUrl={official.photoUrl}
          size={72}
          shape="square"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
                {official.positionLabel}
              </p>
              <h2 className="mt-0.5 text-lg font-bold tracking-tight">
                {official.name}
              </h2>
            </div>
            <FavoriteStar
              routeId={official.routeId}
              name={official.name}
              positionLabel={official.positionLabel}
              districtName={official.districtName}
              partyColor={partyColor}
            />
          </div>
          <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
            {official.party && (
              <>
                <span
                  aria-hidden
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: partyColor }}
                />
                <span>{official.party.name}</span>
                <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
              </>
            )}
            <span className="truncate">{official.districtName}</span>
          </p>

          {official.facts && <AssemblyFacts facts={official.facts} />}
        </div>
      </div>
      <Link
        href={`/politicians/${official.routeId}`}
        className="block border-t border-zinc-100 px-4 py-2.5 text-center text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
      >
        자세히 보기 →
      </Link>
    </article>
  );
}

function AssemblyFacts({
  facts,
}: {
  facts: NonNullable<ElectedOfficial["facts"]>;
}) {
  const items: string[] = [];
  if (facts.voteAttend !== null && facts.voteSession !== null && facts.voteSession > 0) {
    items.push(`표결 ${facts.voteSession}번 중 ${facts.voteAttend}번 참여`);
  }
  if (facts.billProposed !== null) {
    items.push(`법안 ${facts.billProposed}건 발의`);
  }
  if (items.length === 0) return null;
  return (
    <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
      {items.join(" · ")}
    </p>
  );
}
