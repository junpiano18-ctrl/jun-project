import Link from "next/link";
import { notFound } from "next/navigation";
import { REGION_CENTERS, type RegionKey } from "@/lib/geo/region-centers";
import { getRegionMembers } from "@/lib/queries/region-members";

export const dynamic = "force-dynamic";

function isRegionKey(value: string): value is RegionKey {
  return value in REGION_CENTERS;
}

export default async function RegionPage({
  params,
}: PageProps<"/regions/[regionKey]">) {
  const { regionKey } = await params;
  const decoded = decodeURIComponent(regionKey);
  if (!isRegionKey(decoded)) notFound();

  const { fullName, members } = await getRegionMembers(decoded);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href="/map"
        className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← 지도로 돌아가기
      </Link>

      <p className="mb-2 text-xs uppercase tracking-widest text-zinc-400">
        우리 동네 일꾼
      </p>
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          지역구 {members.length}명 · 비례대표 제외
        </p>
      </header>

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {members.map((m) => (
          <li key={m.monaCd}>
            <Link
              href={`/politicians/${m.monaCd}`}
              className="flex items-center gap-3 py-3.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span
                aria-hidden
                className="h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: m.party?.color ?? "#888888" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{m.name}</div>
                <div className="truncate text-xs text-zinc-500">{m.districtName}</div>
              </div>
              <div className="text-xs text-zinc-500">{m.party?.name ?? "무소속"}</div>
              <span className="text-zinc-300 dark:text-zinc-700">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
