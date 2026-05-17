// 폴리곤 centroid 계산 (surveyor's formula).
// GeoJSON 좌표는 [lng, lat] 순. 반환은 [lat, lng].

type Ring = number[][]; // [[lng, lat], ...]

function ringCentroid(ring: Ring): { lat: number; lng: number; area: number } {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  // twiceArea 부호와 무관하게 절댓값 비교에 쓸 수 있도록 area 자체도 부호 유지.
  const area = twiceArea / 2;
  const denom = 6 * area;
  return {
    lat: cy / denom,
    lng: cx / denom,
    area: Math.abs(area),
  };
}

export function geometryCentroid(geometry: {
  type: string;
  coordinates: unknown;
}): [number, number] | null {
  if (geometry.type === "Polygon") {
    const outer = (geometry.coordinates as Ring[])[0];
    if (!outer || outer.length < 3) return null;
    const c = ringCentroid(outer);
    return [c.lat, c.lng];
  }
  if (geometry.type === "MultiPolygon") {
    // 각 polygon의 outer ring centroid를 면적 가중 평균.
    const polys = geometry.coordinates as Ring[][];
    let sumArea = 0;
    let sumLat = 0;
    let sumLng = 0;
    for (const poly of polys) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const c = ringCentroid(outer);
      sumArea += c.area;
      sumLat += c.lat * c.area;
      sumLng += c.lng * c.area;
    }
    if (sumArea === 0) return null;
    return [sumLat / sumArea, sumLng / sumArea];
  }
  return null;
}
