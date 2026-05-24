"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Polygon, Popup } from "react-leaflet";
import type { LatLngExpression, Polygon as LeafletPolygon } from "leaflet";
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
          <DistrictPolygon
            key={f.properties.SGG_Code}
            positions={positions}
            color={color}
            isHovered={isHovered}
            featureKey={featureKey}
            onHover={onHover}
          >
            <Popup>
              {pin ? (
                <PoliticianCard pin={pin} />
              ) : (
                <VacantDistrictCard districtName={f.properties.SIDO_SGG} />
              )}
            </Popup>
          </DistrictPolygon>
        );
      })}
    </>
  );
}

// 폴리곤 한 개를 메모이즈된 pathOptions/eventHandlers와 함께 렌더.
// react-leaflet 5의 Polygon은 매 렌더마다 setStyle을 호출하므로
// 250개 폴리곤이 동시에 매번 restyle 되는 걸 피해야 hover 강조가 안정적.
// 또 hover 시 bringToFront로 markerPane 아래의 폴리곤이 다른 폴리곤에 가려지지 않게 한다.
function DistrictPolygon({
  positions,
  color,
  isHovered,
  featureKey,
  onHover,
  children,
}: {
  positions: LatLngExpression[][];
  color: string;
  isHovered: boolean;
  featureKey: string | undefined;
  onHover?: (key: string | null) => void;
  children: React.ReactNode;
}) {
  const polyRef = useRef<LeafletPolygon | null>(null);

  const pathOptions = useMemo(
    () => ({
      // 호버 시엔 정당색 굵은 테두리, 평소엔 옅은 회색 얇은 선.
      color: isHovered ? color : "#9ca3af",
      weight: isHovered ? 3 : 1,
      opacity: isHovered ? 1 : 0.6,
      fillColor: color,
      fillOpacity: isHovered ? 0.35 : 0,
    }),
    [color, isHovered],
  );

  const eventHandlers = useMemo(
    () => ({
      mouseover: () => {
        if (featureKey) onHover?.(featureKey);
      },
      mouseout: () => {
        if (featureKey) onHover?.(null);
      },
    }),
    [featureKey, onHover],
  );

  // hover 상태가 켜지면 폴리곤을 overlayPane 안에서 맨 앞으로 끌어올린다.
  // 인접 폴리곤이나 자기 위에 그려진 마커 그림자에 강조 테두리가 묻히지 않도록.
  useEffect(() => {
    if (isHovered && polyRef.current) {
      polyRef.current.bringToFront();
    }
  }, [isHovered]);

  return (
    <Polygon
      ref={polyRef}
      positions={positions}
      pathOptions={pathOptions}
      eventHandlers={eventHandlers}
    >
      {children}
    </Polygon>
  );
}
