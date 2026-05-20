"use client";

import { useEffect, useMemo, useState } from "react";
import { Polygon, Popup } from "react-leaflet";
import type { LatLngExpression, LeafletMouseEvent } from "leaflet";
import {
  PoliticianCard,
  VacantDistrictCard,
} from "@/components/politician/PoliticianCard";
import {
  buildGeoJsonKeyMap,
  normalizeDbDistrict,
} from "@/lib/geo/district-key";
import type { PoliticianPin } from "@/lib/queries/politician-pins";

type Feature = {
  type: "Feature";
  properties: { SGG_Code: number; SIDO_SGG: string; SIDO: string; SGG: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

// GeoJSON [lng,lat] → Leaflet [lat,lng]로 변환. 외곽 + 구멍 모두.
function toPositions(geom: Feature["geometry"]): LatLngExpression[][] {
  if (geom.type === "Polygon") {
    return (geom.coordinates as number[][][]).map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number]),
    );
  }
  // MultiPolygon: 각 polygon의 외곽만 합쳐 한 Polygon 컴포넌트에 넣음.
  // (Leaflet Polygon은 첫 ring이 외곽, 이후는 모두 구멍으로 해석되므로 다중 외곽은 분리 렌더.)
  return (geom.coordinates as number[][][][]).flatMap((poly) =>
    poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
  );
}

type Props = {
  pins: PoliticianPin[];
  // KoreaMap이 들고 있는 공유 hover 상태. 마커 hover와 폴리곤 hover를 동일한 강조로 묶음.
  hoveredKey?: string | null;
  onHover?: (key: string | null) => void;
};

export default function DistrictBoundaries({ pins, hoveredKey, onHover }: Props) {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);

  // 클라이언트 사이드 lazy fetch — 지도 본문이 먼저 뜨도록.
  useEffect(() => {
    let cancelled = false;
    fetch("/data/districts-22.geojson")
      .then((r) => r.json())
      .then((data: FeatureCollection) => {
        if (!cancelled) setGeojson(data);
      })
      .catch((e) => console.error("선거구 경계 로드 실패:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  // GeoJSON 폴리곤은 22대 국회의원 지역구. national 레이어 핀만 매핑한다.
  const pinByKey = useMemo(() => {
    const m = new Map<string, PoliticianPin>();
    for (const p of pins) {
      if (p.layer !== "national") continue;
      const key = normalizeDbDistrict(p.districtName);
      if (key) m.set(key, p);
    }
    return m;
  }, [pins]);

  const featureKeyMap = useMemo(() => {
    if (!geojson) return null;
    return buildGeoJsonKeyMap(geojson.features);
  }, [geojson]);

  // feature → { key, pin } 매핑. key는 마커-폴리곤 hover 연동에 사용.
  const featureMeta = useMemo(() => {
    if (!featureKeyMap) return new Map<Feature, { key: string; pin: PoliticianPin | null }>();
    const m = new Map<Feature, { key: string; pin: PoliticianPin | null }>();
    for (const [key, feature] of featureKeyMap) {
      m.set(feature as Feature, { key, pin: pinByKey.get(key) ?? null });
    }
    return m;
  }, [featureKeyMap, pinByKey]);

  if (!geojson) return null;

  return (
    <>
      {geojson.features.map((f) => {
        const meta = featureMeta.get(f);
        const pin = meta?.pin ?? null;
        const featureKey = meta?.key;
        const color = pin?.party?.color ?? "#9ca3af";
        const positions = toPositions(f.geometry);
        const isHovered = featureKey !== undefined && featureKey === hoveredKey;
        return (
          <Polygon
            key={f.properties.SGG_Code}
            positions={positions}
            pathOptions={{
              color: "#9ca3af",
              weight: isHovered ? 2 : 1,
              opacity: isHovered ? 1 : 0.6,
              fillColor: color,
              fillOpacity: isHovered ? 0.35 : 0,
            }}
            eventHandlers={{
              mouseover: (_e: LeafletMouseEvent) => {
                if (featureKey) onHover?.(featureKey);
              },
              mouseout: (_e: LeafletMouseEvent) => {
                if (featureKey) onHover?.(null);
              },
            }}
          >
            <Popup>
              {pin ? (
                <PoliticianCard pin={pin} />
              ) : (
                <VacantDistrictCard districtName={f.properties.SIDO_SGG} />
              )}
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}
