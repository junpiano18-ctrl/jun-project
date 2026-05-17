// DB District.name ↔ OhmyNews GeoJSON 매칭용 정규화 키.
// 키 형식: "시도|core|suffix"
//
// 양쪽에 똑같은 정규화(시·군·구 글자 단순 제거)를 적용하면 비대칭이 사라진다.
//   DB "서울 마포구갑"            ↔ GeoJSON "서울 마포갑"           → "서울|마포|갑"
//   DB "강원 동해시태백시삼척시정선군" ↔ GeoJSON "강원 동해태백삼척정선" → "강원|동해태백삼척정선|"
//   DB "광주 동구남구갑"          ↔ GeoJSON "광주 동구남구갑"      → "광주|동남|갑"
//   DB "세종특별자치시갑"         ↔ GeoJSON "세종 세종갑"           → "세종|세종|갑"
//
// GeoJSON 약칭은 자치단체명이 우연히 "정"으로 끝나는 케이스("성남수정", "금정")가 있어
// 마지막 글자만 보고 갑/을/병/정/무로 분리하면 안 된다.
// 같은 시도 안에서 "마지막 한 글자만 다른" 항목이 ≥2개일 때만 분기로 판단한다.

const SUFFIXES = ["갑", "을", "병", "정", "무"];

function compress(s: string): string {
  return s
    .replace(/특별자치시|특별자치도|특별시|광역시/g, "")
    .replace(/[시군구]/g, "");
}

export function normalizeDbDistrict(name: string): string | null {
  if (!name) return null;

  // 세종은 공백 없이 "세종특별자치시갑" 형태.
  if (name.startsWith("세종특별자치시")) {
    const rest = name.slice("세종특별자치시".length);
    const suffix = SUFFIXES.includes(rest) ? rest : "";
    return `세종|세종|${suffix}`;
  }

  const parts = name.split(/\s+/);
  if (parts.length < 2) return null;
  const sido = parts[0];
  let body = parts.slice(1).join("");
  let suffix = "";
  const last = body.slice(-1);
  if (SUFFIXES.includes(last)) {
    suffix = last;
    body = body.slice(0, -1);
  }
  return `${sido}|${compress(body)}|${suffix}`;
}

// GeoJSON: suffix 분리를 group counting으로. SIDO_SGG가 "성남수정", "금정"처럼
// 자치단체명이 우연히 SUFFIXES 글자로 끝나는 케이스를 단일 선거구로 인식한다.
export function buildGeoJsonKeyMap<
  F extends { properties: { SIDO_SGG: string } },
>(features: F[]): Map<string, F> {
  type Item = { feature: F; sido: string; body: string };
  const items: Item[] = [];
  const groupCounts = new Map<string, number>();

  for (const f of features) {
    const sidoSgg = f.properties.SIDO_SGG;
    if (!sidoSgg) continue;
    const parts = sidoSgg.split(/\s+/);
    if (parts.length < 2) continue;
    const sido = parts[0];
    const body = parts.slice(1).join("");
    items.push({ feature: f, sido, body });

    const last = body.slice(-1);
    if (SUFFIXES.includes(last)) {
      const groupKey = `${sido}|${body.slice(0, -1)}`;
      groupCounts.set(groupKey, (groupCounts.get(groupKey) ?? 0) + 1);
    }
  }

  const map = new Map<string, F>();
  for (const { feature, sido, body } of items) {
    const last = body.slice(-1);
    let suffix = "";
    let base = body;
    if (SUFFIXES.includes(last)) {
      const groupKey = `${sido}|${body.slice(0, -1)}`;
      if ((groupCounts.get(groupKey) ?? 0) >= 2) {
        suffix = last;
        base = body.slice(0, -1);
      }
    }
    map.set(`${sido}|${compress(base)}|${suffix}`, feature);
  }
  return map;
}
