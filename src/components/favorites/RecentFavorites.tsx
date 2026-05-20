"use client";

import Link from "next/link";
import { useFavorites } from "@/components/favorites/useFavorites";

// 랜딩 페이지의 즐겨찾기 섹션.
// - mounted 전이거나 즐겨찾기 없으면 아무것도 렌더하지 않음 (히어로 비주얼 보존).
// - 칩 클릭 시 /politicians/[routeId] 로 이동.
export function RecentFavorites() {
  const { favorites, mounted } = useFavorites();
  if (!mounted || favorites.length === 0) return null;

  return (
    <section className="mt-10 text-left">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        내가 별표한 일꾼
      </h2>
      <ul className="flex flex-wrap gap-2">
        {favorites.map((f) => (
          <li key={f.routeId}>
            <Link
              href={`/politicians/${f.routeId}`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              <span
                aria-hidden
                className="h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: f.partyColor }}
              />
              <span className="font-medium">{f.name}</span>
              <span className="text-xs text-zinc-500">{f.positionLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
