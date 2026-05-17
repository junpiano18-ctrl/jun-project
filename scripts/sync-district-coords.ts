// District.centerLat/centerLng를 OhmyNews 22대 선거구 GeoJSON의 polygon centroid로 채운다.
//   npx tsx scripts/sync-district-coords.ts
//
// 멱등 — GeoJSON 또는 매핑 알고리즘 변경 후 다시 돌리면 갱신.

import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { geometryCentroid } from "../src/lib/geo/centroid";
import {
  buildGeoJsonKeyMap,
  normalizeDbDistrict,
} from "../src/lib/geo/district-key";

type Feature = {
  type: "Feature";
  properties: { SGG_Code: number; SIDO_SGG: string; SIDO: string; SGG: string };
  geometry: { type: string; coordinates: unknown };
};

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
  });

  try {
    const geojson = JSON.parse(
      readFileSync("public/data/districts-22.geojson", "utf-8"),
    ) as { features: Feature[] };

    const featureByKey = buildGeoJsonKeyMap(geojson.features);
    console.log(`GeoJSON: ${geojson.features.length} features → ${featureByKey.size} unique keys`);

    const districts = await prisma.district.findMany({
      where: { positionType: "NATIONAL_ASSEMBLY", isProportional: false },
      orderBy: { name: "asc" },
    });

    let updated = 0;
    const failed: string[] = [];
    for (const d of districts) {
      const key = normalizeDbDistrict(d.name);
      const f = key ? featureByKey.get(key) : undefined;
      if (!f) { failed.push(`${d.name}  (key=${key ?? "(null)"})`); continue; }

      const centroid = geometryCentroid(f.geometry);
      if (!centroid) { failed.push(`${d.name}  (centroid 계산 실패)`); continue; }

      await prisma.district.update({
        where: { id: d.id },
        data: { centerLat: centroid[0], centerLng: centroid[1] },
      });
      updated++;
    }

    console.log(`✓ ${updated}/${districts.length} District 좌표 갱신`);
    if (failed.length) {
      console.error(`✗ 실패 ${failed.length}건:`);
      for (const n of failed) console.error(`  - ${n}`);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
