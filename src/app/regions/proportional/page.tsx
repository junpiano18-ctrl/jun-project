import Link from "next/link";
import { getProportionalMembers } from "@/lib/queries/region-members";

export const dynamic = "force-dynamic";

export default async function ProportionalPage() {
  const groups = await getProportionalMembers();
  const total = groups.reduce((acc, g) => acc + g.members.length, 0);

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
        <h1 className="text-2xl font-bold tracking-tight">비례대표</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {total}명 · 정당별 정렬
        </p>
      </header>

      <div className="space-y-7 pt-6">
        {groups.map((g) => (
          <section key={g.partyName}>
            <div className="mb-2 flex items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: g.partyColor }}
              />
              <h2 className="text-sm font-semibold">{g.partyName}</h2>
              <span className="text-xs text-zinc-500">{g.members.length}명</span>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3 md:grid-cols-4">
              {g.members.map((m) => (
                <li key={m.monaCd}>
                  <Link
                    href={`/politicians/${m.monaCd}`}
                    className="block rounded px-2 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  >
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
