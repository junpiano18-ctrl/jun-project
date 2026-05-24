"use client";

import { useEffect, useState } from "react";
import {
  loadFavorites,
  STORAGE_EVENT,
  STORAGE_KEY,
  type FavoriteOfficial,
} from "@/lib/favorites";

// SSR 안전한 즐겨찾기 hook.
// - mounted=false 일 때는 빈 배열 반환 → 서버/하이드레이션 불일치 방지
// - 같은 탭에서 변경되면 STORAGE_EVENT, 다른 탭에서 변경되면 storage 이벤트 수신
export function useFavorites(): {
  favorites: FavoriteOfficial[];
  mounted: boolean;
} {
  const [favorites, setFavorites] = useState<FavoriteOfficial[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // SSR hydration mismatch 방지 — 서버 렌더 시 mounted=false, 클라 mount 후 true.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setFavorites(loadFavorites());
    function refresh() {
      setFavorites(loadFavorites());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) refresh();
    }
    window.addEventListener(STORAGE_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STORAGE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { favorites, mounted };
}
