// 광역 시·도 17개 중심 좌표 (대략적 위경도).
// 지도 첫 화면에서 의원 수 배지를 띄울 때 사용한다.
// 정밀 폴리곤은 다음 단계에 GeoJSON으로 도입.

export type RegionKey =
  | "서울"
  | "부산"
  | "대구"
  | "인천"
  | "광주"
  | "대전"
  | "울산"
  | "세종"
  | "경기"
  | "강원"
  | "충북"
  | "충남"
  | "전북"
  | "전남"
  | "경북"
  | "경남"
  | "제주";

export const REGION_CENTERS: Record<RegionKey, { lat: number; lng: number; fullName: string }> = {
  서울: { lat: 37.5665, lng: 126.978, fullName: "서울특별시" },
  부산: { lat: 35.1796, lng: 129.0756, fullName: "부산광역시" },
  대구: { lat: 35.8714, lng: 128.6014, fullName: "대구광역시" },
  인천: { lat: 37.4563, lng: 126.7052, fullName: "인천광역시" },
  광주: { lat: 35.1595, lng: 126.8526, fullName: "광주광역시" },
  대전: { lat: 36.3504, lng: 127.3845, fullName: "대전광역시" },
  울산: { lat: 35.5384, lng: 129.3114, fullName: "울산광역시" },
  세종: { lat: 36.4801, lng: 127.289, fullName: "세종특별자치시" },
  경기: { lat: 37.4138, lng: 127.5183, fullName: "경기도" },
  강원: { lat: 37.8228, lng: 128.1555, fullName: "강원특별자치도" },
  충북: { lat: 36.6357, lng: 127.4915, fullName: "충청북도" },
  충남: { lat: 36.5184, lng: 126.8, fullName: "충청남도" },
  전북: { lat: 35.7175, lng: 127.153, fullName: "전북특별자치도" },
  전남: { lat: 34.8679, lng: 126.991, fullName: "전라남도" },
  경북: { lat: 36.576, lng: 128.5056, fullName: "경상북도" },
  경남: { lat: 35.4606, lng: 128.2132, fullName: "경상남도" },
  제주: { lat: 33.4996, lng: 126.5312, fullName: "제주특별자치도" },
};

// District.name에서 광역 키 추출.
// 예: "경기 안양시만안구" → "경기", "세종특별자치시갑" → "세종".
// 비례대표는 null (지도에 표시하지 않음).
export function regionKeyFor(districtName: string, isProportional: boolean): RegionKey | null {
  if (isProportional) return null;
  if (districtName.startsWith("세종")) return "세종";
  const first = districtName.split(/\s+/)[0] as RegionKey;
  return first in REGION_CENTERS ? first : null;
}

export const REGION_KEYS = Object.keys(REGION_CENTERS) as RegionKey[];
