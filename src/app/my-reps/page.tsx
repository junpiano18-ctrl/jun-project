import Link from "next/link";
import { OfficialCard } from "@/components/landing/OfficialCard";
import { getRegionFeed } from "@/lib/queries/region-feed";
import type { OfficialPosition } from "@/lib/queries/region-officials";

export const dynamic = "force-dynamic";

const POSITION_ORDER: { position: OfficialPosition; icon: string; label: string }[] = [
  { position: "NATIONAL_ASSEMBLY", icon: "🏛️", label: "국회의원" },
  { position: "METRO_GOVERNOR", icon: "🏙️", label: "광역단체장" },
  { position: "EDUCATION_SUPERINTENDENT", icon: "🎓", label: "교육감" },
  { position: "LOCAL_GOVERNOR", icon: "🏘️", label: "기초단체장" },
];

export default async function MyRepsPage({
  searchParams,
}: {
  searchParams: Promise<{ adm?: string }>;
}) {
  const { adm } = await searchParams;
  const result = adm ? await getRegionFeed(adm) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← 처음으로
      </Link>

      {result ? (
        <>
          <header>
            <p className="text-sm text-zinc-500">
              {result.sidonm} {result.sggnm}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {result.dongName} 일꾼들 👋
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              최근 법안 발의 · 본회의 표결 · 재산 신고
            </p>
          </header>

          {result.officials.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              아직 이 지역 데이터가 없어요.
            </p>
          ) : (
            POSITION_ORDER.map(({ position, icon, label }) => {
              const group = result.officials.filter((o) => o.position === position);
              if (group.length === 0) return null;
              return (
                <section key={position} className="mt-8">
                  <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    {icon} {label}
                  </h2>
                  <div className="space-y-4">
                    {group.map((o) => (
                      <OfficialCard key={`${o.position}-${o.routeId}`} official={o} />
                    ))}
                  </div>
                </section>
              );
            })
          )}

          <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <Link
              href="/map"
              className="text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              전체 지도에서 보기 →
            </Link>
          </div>

          <p className="mt-8 text-xs text-zinc-400">
            판단은 유권자가, 데이터는 내머슴닷컴이 제공합니다.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            우리 동네 일꾼
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            먼저 주소를 검색해 주세요.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            처음 화면으로 →
          </Link>
        </>
      )}
    </main>
  );
}
