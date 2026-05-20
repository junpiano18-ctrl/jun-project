// 로그인 없이 localStorage로 보관하는 즐겨찾기.
// SSR 안전 — window 가드 + 클라이언트에서만 동작.

export type FavoriteOfficial = {
  routeId: string; // /politicians/[id]
  name: string;
  positionLabel: string; // "국회의원" / "고양시장" 등
  districtName: string;
  partyColor: string;
  addedAt: number;
};

export const STORAGE_KEY = "naemeosum:favorites";
export const STORAGE_EVENT = "naemeosum:favorites:changed";

export function loadFavorites(): FavoriteOfficial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is FavoriteOfficial =>
        x !== null &&
        typeof x === "object" &&
        typeof (x as FavoriteOfficial).routeId === "string" &&
        typeof (x as FavoriteOfficial).name === "string",
    );
  } catch {
    return [];
  }
}

function save(items: FavoriteOfficial[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  // 같은 탭의 다른 컴포넌트에도 변경 알림 (storage 이벤트는 다른 탭만 받음).
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function toggleFavorite(item: Omit<FavoriteOfficial, "addedAt">): boolean {
  if (typeof window === "undefined") return false;
  const items = loadFavorites();
  const idx = items.findIndex((f) => f.routeId === item.routeId);
  if (idx >= 0) {
    items.splice(idx, 1);
    save(items);
    return false;
  }
  items.unshift({ ...item, addedAt: Date.now() });
  save(items);
  return true;
}

export function isFavorited(routeId: string): boolean {
  return loadFavorites().some((f) => f.routeId === routeId);
}
