"use client";

import { useEffect, useState } from "react";
import {
  loadFavorites,
  STORAGE_EVENT,
  STORAGE_KEY,
  toggleFavorite,
  type FavoriteOfficial,
} from "@/lib/favorites";

type Props = Omit<FavoriteOfficial, "addedAt">;

export function FavoriteStar(props: Props) {
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () =>
      setActive(loadFavorites().some((f) => f.routeId === props.routeId));
    sync();
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) sync();
    }
    window.addEventListener(STORAGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STORAGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [props.routeId]);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const nowActive = toggleFavorite(props);
    setActive(nowActive);
  }

  // SSR/하이드레이션 직후엔 비활성 모양으로 통일.
  const display = mounted && active;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={display}
      aria-label={display ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      title={display ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-xl transition ${
        display
          ? "text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          : "text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      }`}
    >
      <span aria-hidden>{display ? "★" : "☆"}</span>
    </button>
  );
}
