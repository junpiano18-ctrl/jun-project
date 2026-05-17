// 행정동 → 22대 선거구 매핑 테이블을 빌드한다.
//   npx tsx scripts/build-dong-mapping.ts
//
// 1. data/admdong-20240401.geojson (3,553 행정동)
// 2. public/data/districts-22.geojson (254 선거구)
// 3. 각 행정동 centroid가 어느 선거구 폴리곤 안에 들어가는지 검사
// 4. GeoJSON 약칭 ↔ DB District.name 매핑까지 한 번에 풀어서 결과 JSON에 저장
// 5. → src/lib/geo/dong-to-district.json (런타임에 그대로 사용)

import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { geometryCentroid } from "../src/lib/geo/centroid";
import {
  buildGeoJsonKeyMap,
  normalizeDbDistrict,
} from "../src/lib/geo/district-key";
import {
  bboxOf,
  pointInGeometry,
} from "../src/lib/geo/point-in-polygon";

type DongFeature = {
  type: "Feature";
  properties: {
    adm_cd: string;
    adm_nm: string;
    sidonm: string;
    sggnm: string;
  };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

type DistFeature = {
  type: "Feature";
  properties: { SGG_Code: number; SIDO_SGG: string; SIDO: string; SGG: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

async function main() {
  console.log("Loading 행정동 GeoJSON...");
  const dongFc = JSON.parse(
    readFileSync("data/admdong-20240401.geojson", "utf-8"),
  ) as { features: DongFeature[] };

  console.log("Loading 선거구 GeoJSON...");
  const distFc = JSON.parse(
    readFileSync("public/data/districts-22.geojson", "utf-8"),
  ) as { features: DistFeature[] };

  console.log(`행정동 ${dongFc.features.length}개, 선거구 ${distFc.features.length}개`);

  // GeoJSON feature → 정규화 key 사전. 전체 254 feature로 분기 그룹 카운팅까지.
  const keyMap = buildGeoJsonKeyMap(distFc.features);
  const featureToKey = new Map<DistFeature, string>();
  for (const [k, f] of keyMap) featureToKey.set(f as DistFeature, k);

  // DB District 풀 → 정규화 key 사전.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });
  const allDistricts = await prisma.district.findMany({
    where: { positionType: "NATIONAL_ASSEMBLY", isProportional: false },
  });
  const dbByKey = new Map<string, (typeof allDistricts)[number]>();
  for (const d of allDistricts) {
    const k = normalizeDbDistrict(d.name);
    if (k) dbByKey.set(k, d);
  }

  // 선거구 bbox 사전 계산
  const distInfos = distFc.features.map((f) => ({
    feature: f,
    bbox: bboxOf(f.geometry),
  }));

  type Entry = {
    adm_cd: string;
    adm_nm: string;
    sidonm: string;
    sggnm: string;
    dongName: string;
    districtSidoSgg: string;
    districtName: string | null; // DB District.name (null이면 의원 없는 선거구)
  };

  const out: Entry[] = [];
  const failed: string[] = [];
  let processed = 0;

  for (const d of dongFc.features) {
    processed++;
    if (processed % 500 === 0) {
      process.stdout.write(`\r  ${processed}/${dongFc.features.length}`);
    }

    const centroid = geometryCentroid(d.geometry);
    if (!centroid) { failed.push(d.properties.adm_nm); continue; }
    const pt: [number, number] = [centroid[1], centroid[0]];

    const candidates = distInfos.filter(
      (di) => pt[0] >= di.bbox[0] && pt[0] <= di.bbox[2] && pt[1] >= di.bbox[1] && pt[1] <= di.bbox[3],
    );

    let matched: DistFeature | null = null;
    for (const c of candidates) {
      if (pointInGeometry(pt, c.feature.geometry)) {
        matched = c.feature;
        break;
      }
    }

    if (!matched) { failed.push(d.properties.adm_nm); continue; }

    const tokens = d.properties.adm_nm.split(/\s+/);
    const dongName = tokens[tokens.length - 1];
    const k = featureToKey.get(matched);
    const dbDistrict = k ? dbByKey.get(k) : undefined;

    out.push({
      adm_cd: d.properties.adm_cd,
      adm_nm: d.properties.adm_nm,
      sidonm: d.properties.sidonm,
      sggnm: d.properties.sggnm,
      dongName,
      districtSidoSgg: matched.properties.SIDO_SGG,
      districtName: dbDistrict?.name ?? null,
    });
  }
  process.stdout.write("\r");

  const withDb = out.filter((o) => o.districtName).length;
  console.log(`✓ ${out.length}/${dongFc.features.length} 행정동 매핑 (DB District 매칭 ${withDb}개)`);
  if (failed.length) {
    console.log(`  매핑 실패 ${failed.length}건. 처음 5: ${failed.slice(0, 5).join(", ")}`);
  }

  const target = "src/lib/geo/dong-to-district.json";
  writeFileSync(target, JSON.stringify(out), "utf-8");
  console.log(`✓ ${target} 저장 (${(JSON.stringify(out).length / 1024).toFixed(0)}KB)`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
