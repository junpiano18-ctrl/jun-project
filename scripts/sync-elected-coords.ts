// 광역단체장·교육감·기초단체장 District의 centerLat/centerLng 채우기.
//   npx tsx scripts/sync-elected-coords.ts
//
// 광역단체장·교육감 (17명 × 2): 시도 단위 정적 좌표
// 기초단체장 (226명): 행정동 GeoJSON에서 시군구별 centroid 평균
//
// 멱등 — 좌표 데이터 변경 후 다시 돌리면 갱신.

import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { geometryCentroid } from "../src/lib/geo/centroid";

// 17개 시도 중심 좌표. "강원도"/"강원특별자치도", "제주도"/"제주특별자치도" 등 신·구 명칭 모두 인정.
const SIDO_COORDS: Record<string, [number, number]> = {
  서울특별시: [37.5665, 126.978],
  부산광역시: [35.1796, 129.0756],
  대구광역시: [35.8714, 128.6014],
  인천광역시: [37.4563, 126.7052],
  광주광역시: [35.1595, 126.8526],
  대전광역시: [36.3504, 127.3845],
  울산광역시: [35.5384, 129.3114],
  세종특별자치시: [36.4801, 127.289],
  경기도: [37.4138, 127.5183],
  강원도: [37.8228, 128.1555],
  강원특별자치도: [37.8228, 128.1555],
  충청북도: [36.6357, 127.4915],
  충청남도: [36.5184, 126.8],
  전라북도: [35.7175, 127.153],
  전북특별자치도: [35.7175, 127.153],
  전라남도: [34.8679, 126.991],
  경상북도: [36.576, 128.5056],
  경상남도: [35.4606, 128.2132],
  제주특별자치도: [33.4996, 126.5312],
  제주도: [33.4996, 126.5312],
};

// 시도명 정규화: "강원특별자치도" → "강원도" 같은 동등화.
function canonicalSido(s: string): string {
  return s
    .replace("강원특별자치도", "강원도")
    .replace("전북특별자치도", "전라북도")
    .replace("제주특별자치도", "제주특별자치도"); // 그대로 — 행정동 GeoJSON도 이렇게 표기
}

type DongFeature = {
  type: "Feature";
  properties: { adm_nm: string; sidonm: string; sggnm: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    // ── 1) 광역단체장·교육감 ──
    const metroDistricts = await prisma.district.findMany({
      where: { positionType: { in: ["METRO_GOVERNOR", "EDUCATION_SUPERINTENDENT"] } },
    });
    console.log(`광역단체장·교육감 District ${metroDistricts.length}개`);

    let metroOk = 0;
    const metroFailed: string[] = [];
    for (const d of metroDistricts) {
      const c = SIDO_COORDS[d.name];
      if (!c) { metroFailed.push(d.name); continue; }
      await prisma.district.update({
        where: { id: d.id },
        data: { centerLat: c[0], centerLng: c[1] },
      });
      metroOk++;
    }
    console.log(`  ✓ ${metroOk}/${metroDistricts.length} 좌표 갱신`);
    if (metroFailed.length) console.log(`  ✗ 매칭 실패: ${metroFailed.join(", ")}`);

    // ── 2) 기초단체장 (시군구 centroid) ──
    console.log("\n행정동 GeoJSON 로드 (시군구 centroid 계산)...");
    const geojson = JSON.parse(
      readFileSync("data/admdong-20240401.geojson", "utf-8"),
    ) as { features: DongFeature[] };

    // 시군구별 행정동 centroid 모음 → 평균.
    // 일반구 시(예: 수원시 영통구)는 시 단위 키도 별도 등록해 시 전체 centroid도 계산.
    const buckets = new Map<string, Array<[number, number]>>();
    for (const f of geojson.features) {
      const sd = canonicalSido(f.properties.sidonm ?? "");
      const sgg = f.properties.sggnm ?? "";
      if (!sd || !sgg) continue;
      const c = geometryCentroid(f.geometry);
      if (!c) continue;
      const push = (key: string) => {
        const arr = buckets.get(key) ?? [];
        arr.push(c);
        buckets.set(key, arr);
      };
      push(`${sd}|${sgg}`);
      // 일반구 분리: "수원시영통구" / "성남시분당구" 등 → "수원시" 키에도 누적
      const siOnly = sgg.match(/^([가-힣]+?시)[가-힣]+구$/);
      if (siOnly) push(`${sd}|${siOnly[1]}`);
    }
    const sggCoords = new Map<string, [number, number]>();
    for (const [k, arr] of buckets) {
      const lat = arr.reduce((a, c) => a + c[0], 0) / arr.length;
      const lng = arr.reduce((a, c) => a + c[1], 0) / arr.length;
      sggCoords.set(k, [lat, lng]);
    }
    console.log(`  ${sggCoords.size}개 시군구 centroid 계산 완료`);

    const localDistricts = await prisma.district.findMany({
      where: { positionType: "LOCAL_GOVERNOR" },
    });
    console.log(`기초단체장 District ${localDistricts.length}개`);

    let localOk = 0;
    const localFailed: string[] = [];
    for (const d of localDistricts) {
      // District.name = "강원도 강릉시" → 첫 공백으로 분리
      const parts = d.name.split(/\s+/);
      if (parts.length < 2) { localFailed.push(d.name); continue; }
      const sd = canonicalSido(parts[0]);
      const sgg = parts.slice(1).join(" ");
      let c = sggCoords.get(`${sd}|${sgg}`);
      // 일반구 별도 표기 케이스의 첫 2토큰 매칭
      if (!c && parts.length >= 3) {
        c = sggCoords.get(`${sd}|${parts[1]}`);
      }
      // 행정구역 개편 fallback — 시도 무관, 같은 sgg 이름이 있으면 사용 (예: 경상북도 군위군 → 대구광역시 군위군)
      if (!c) {
        for (const [k, v] of sggCoords) {
          if (k.endsWith(`|${sgg}`)) { c = v; break; }
        }
      }
      if (!c) { localFailed.push(d.name); continue; }
      await prisma.district.update({
        where: { id: d.id },
        data: { centerLat: c[0], centerLng: c[1] },
      });
      localOk++;
    }
    console.log(`  ✓ ${localOk}/${localDistricts.length} 좌표 갱신`);
    if (localFailed.length) {
      console.log(`  ✗ 매칭 실패 ${localFailed.length}건:`);
      for (const n of localFailed.slice(0, 20)) console.log(`    - ${n}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
