import Link from "next/link";
import { AddressSearch } from "@/components/landing/AddressSearch";
import { RecentFavorites } from "@/components/favorites/RecentFavorites";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-12 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_42%,_theme(colors.zinc.100)_0%,_transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_42%,_theme(colors.zinc.900)_0%,_transparent_60%)]"
      />

      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          내머슴닷컴
        </h1>
        <p className="mt-3 text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
          내가 뽑고, 내가 감시한다
        </p>

        <div className="mt-10 text-left">
          <AddressSearch />
        </div>

        <div className="mt-6 text-sm text-zinc-500">
          또는{" "}
          <Link
            href="/map"
            className="font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            전체 지도 보기
          </Link>
        </div>

        <RecentFavorites />

        <p className="mt-12 text-xs text-zinc-400">
          세금으로 일하는 사람들, 제대로 일하나요?
        </p>
      </div>
    </main>
  );
}
