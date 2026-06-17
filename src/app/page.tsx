import Link from "next/link";
import { AddressSearch } from "@/components/landing/AddressSearch";
import { RecentFavorites } from "@/components/favorites/RecentFavorites";
import { TodayFeed } from "@/components/landing/TodayFeed";
import { getHomeFeed } from "@/lib/queries/home-feed";
import { getTodaySchedule } from "@/lib/sources/assembly-schedule";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [feed, schedule] = await Promise.all([
    getHomeFeed(),
    getTodaySchedule(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl">
      {/* ── 1. 최상단 sticky 검색창 — 스크롤해도 항상 보임 ──
          SiteHeader가 랜딩에서는 숨겨지므로 top:0이 곧 최상단.
          bg-white + border-b로 sticky 상태에서 아래 보라빛 배경과 시각적 분리. */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-6 py-5 sm:py-6">
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
            내머슴<span className="text-[#7C3AED]">닷컴</span>
          </span>
          <span className="text-xs text-zinc-400 sm:text-sm">
            내가 뽑고, 내가 감시한다
          </span>
        </div>
        <AddressSearch />

        {/* 검색창 아래 작은 outline 네비 버튼 두 개 — 모바일에서도 나란히 */}
        <div className="mt-3 flex gap-2">
          <Link
            href="/map"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#7C3AED] px-3 py-2 text-xs font-semibold text-[#7C3AED] transition hover:bg-[#EDE9FE]"
          >
            <span aria-hidden>🗺️</span> 지도로 보기
          </Link>
          <Link
            href="/bills"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#7C3AED] px-3 py-2 text-xs font-semibold text-[#7C3AED] transition hover:bg-[#EDE9FE]"
          >
            <span aria-hidden>📋</span> 법안 보기
          </Link>
        </div>
      </div>

      {/* ── 2. 오늘의 국회 2x2 그리드 ── */}
      <section aria-labelledby="today-heading" className="px-6 pt-8">
        <h2
          id="today-heading"
          className="mb-4 text-base font-bold tracking-tight text-zinc-900"
        >
          오늘의 국회 <span aria-hidden>📰</span>
        </h2>
        <TodayFeed feed={feed} schedule={schedule} />
      </section>

      {/* ── 3. 우리 동네 섹션 (즐겨찾기 칩 — 비어있으면 아무것도 안 그림) ── */}
      <section aria-labelledby="local-heading" className="mt-10 px-6">
        <h2
          id="local-heading"
          className="mb-3 text-base font-bold tracking-tight text-zinc-900"
        >
          우리 동네 일꾼 보기 <span aria-hidden>🏠</span>
        </h2>
        <p className="text-xs text-zinc-500">
          위 검색창에 주소를 입력하세요.
        </p>
        <RecentFavorites />
      </section>

      <footer className="mt-14 px-6 pb-12 text-center text-xs text-zinc-500">
        <p>세금으로 일하는 사람들, 제대로 일하나요?</p>
        <p className="mt-1 text-[10px] text-zinc-400">
          판단은 유권자가, 데이터는 내머슴닷컴이 제공합니다.
        </p>
      </footer>
    </main>
  );
}
