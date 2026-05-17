// 지도 레이어 카테고리 정의.
// 직급 = 모양(shape), 정당 = 색깔(color).
// LAYERS.color는 LayerControl 토글 색 fallback. 핀의 실제 색은 정당색.

export type LayerKey =
  | "national" // 국회의원
  | "metroGov" // 광역단체장
  | "edu" // 교육감
  | "metroCouncil" // 광역의원
  | "localGov" // 기초단체장
  | "localCouncil"; // 기초의원

export type LayerShape = "pentagon" | "star" | "triangle" | "diamond" | "circle" | "square";

export type LayerDef = {
  key: LayerKey;
  label: string;
  shape: LayerShape;
  size: number; // 핀 px (직급 높을수록 큼)
  color: string; // LayerControl fallback (정당 무관)
  available: boolean;
};

export const LAYERS: LayerDef[] = [
  { key: "national", label: "국회의원", shape: "pentagon", size: 24, color: "#3F3F46", available: true },
  { key: "metroGov", label: "광역단체장", shape: "star", size: 24, color: "#3F3F46", available: true },
  { key: "edu", label: "교육감", shape: "triangle", size: 20, color: "#3F3F46", available: true },
  { key: "metroCouncil", label: "광역의원", shape: "square", size: 20, color: "#3F3F46", available: false },
  { key: "localGov", label: "기초단체장", shape: "diamond", size: 20, color: "#3F3F46", available: true },
  { key: "localCouncil", label: "기초의원", shape: "square", size: 18, color: "#3F3F46", available: false },
];

// 줌 레벨별 자동 허용 (참고용 — 현재 visible은 enabled만 사용)
export function allowedAtZoom(zoom: number): Set<LayerKey> {
  if (zoom <= 6) return new Set(["metroGov"]);
  if (zoom <= 9) return new Set(["national", "edu"]);
  if (zoom <= 11) return new Set(["national", "edu", "metroCouncil", "localGov"]);
  return new Set(["national", "metroGov", "edu", "metroCouncil", "localGov", "localCouncil"]);
}

export const ALL_LAYER_KEYS: LayerKey[] = LAYERS.map((l) => l.key);

// 정당 범례용 — 시드된 정당 색 (DB Party.color와 동일하게 유지)
export const PARTY_LEGEND: Array<{ name: string; color: string }> = [
  { name: "더불어민주당", color: "#0052A4" },
  { name: "국민의힘", color: "#E61E2B" },
  { name: "조국혁신당", color: "#5B9BD5" },
  { name: "개혁신당", color: "#FFA940" },
  { name: "무소속/기타", color: "#888888" },
];
