// Ray-casting point-in-polygon.
// 좌표는 GeoJSON 관례대로 [lng, lat] 순.

type Ring = number[][];

function pointInRing(point: [number, number], ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };

export function pointInGeometry(
  point: [number, number],
  geom: Geometry,
): boolean {
  if (geom.type === "Polygon") {
    const rings = geom.coordinates as Ring[];
    if (!rings.length) return false;
    if (!pointInRing(point, rings[0])) return false;
    // 구멍 검사 — 구멍 안이면 제외
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(point, rings[i])) return false;
    }
    return true;
  }
  if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates as Ring[][]) {
      const rings = poly;
      if (!rings.length) continue;
      if (!pointInRing(point, rings[0])) continue;
      let hole = false;
      for (let i = 1; i < rings.length; i++) {
        if (pointInRing(point, rings[i])) { hole = true; break; }
      }
      if (!hole) return true;
    }
    return false;
  }
  return false;
}

// bbox 사전 필터용
export function bboxOf(geom: Geometry): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function consume(ring: Ring) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates as Ring[]) consume(ring);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates as Ring[][]) {
      for (const ring of poly) consume(ring);
    }
  }
  return [minX, minY, maxX, maxY];
}
