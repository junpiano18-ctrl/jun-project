"use client";

import { useCallback, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import DistrictBoundaries from "@/components/map/DistrictBoundaries";
import { FocusedPopup } from "@/components/map/FocusedPopup";
import { LayerControl } from "@/components/map/LayerControl";
import { LayerPinGroup } from "@/components/map/LayerPinGroup";
import { SeaLabels } from "@/components/map/SeaLabels";
import { ZoomTracker } from "@/components/map/ZoomTracker";
import {
  ALL_LAYER_KEYS,
  LAYERS,
  allowedAtZoom,
  type LayerKey,
} from "@/lib/map/layers";
import type { PoliticianPin } from "@/lib/queries/politician-pins";

const CENTER: [number, number] = [36.3, 127.8];
const INITIAL_ZOOM = 7;

// VWorld(국토교통부 공간정보오픈플랫폼) 키가 있으면 한국어 라벨 + 동해 표기 보장 타일,
// 없으면 OSM 기본 타일로 자동 fallback. SeaLabels 오버레이가 어느 쪽에서도 동해/독도 표기를 추가 보장.
const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
const TILE = VWORLD_KEY
  ? {
      url: `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`,
      attribution:
        '지도 © <a href="https://www.vworld.kr" target="_blank" rel="noopener">공간정보오픈플랫폼 VWorld</a>',
    }
  : {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    };

type Props = {
  pins: PoliticianPin[];
  proportionalTotal: number;
};

export default function KoreaMap({ pins, proportionalTotal }: Props) {
  // 기본값: 국회의원만 체크된 상태로 시작. 다른 직급은 사용자가 명시적으로 토글.
  const [enabled, setEnabled] = useState<Set<LayerKey>>(
    () => new Set<LayerKey>(["national"]),
  );
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const allowed = useMemo(() => allowedAtZoom(zoom), [zoom]);

  // 사용자 체크박스가 가시성의 master — 체크박스 OFF면 무조건 사라짐.
  // 줌 마스킹은 LayerControl의 hint("줌 조정")로만 안내, 실제 표시는 막지 않음.
  const visible = enabled;

  const toggleLayer = useCallback((key: LayerKey) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 검색에서 focus 시: 해당 핀의 layer만 추가로 켜고, 사용자가 끈 다른 layer는 건드리지 않음.
  // (이전: 모든 layer 강제 ON → 사용자가 토글로 끈 의도를 덮어쓰는 버그)
  const onFocus = useCallback((layer: LayerKey) => {
    setEnabled((prev) => (prev.has(layer) ? prev : new Set([...prev, layer])));
  }, []);


  return (
    <div className="relative h-full w-full" style={{ height: "100%" }}>
      <MapContainer
        center={CENTER}
        zoom={INITIAL_ZOOM}
        minZoom={6}
        maxZoom={18}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution={TILE.attribution} url={TILE.url} />
        <ZoomTracker onZoom={setZoom} />
        <SeaLabels />
        <DistrictBoundaries pins={pins} />
        <FocusedPopup pins={pins} onFocus={onFocus} />

        {/* 직급별 핀 — 각 layer가 별도 LayerPinGroup. visible.has(layer)=false이면 컴포넌트 자체 unmount.
           leaflet 레벨에서 marker remove가 확실히 동작 → 체크박스 OFF 시 핀이 100% 사라짐. */}
        {ALL_LAYER_KEYS.map((key) =>
          visible.has(key) ? (
            <LayerPinGroup key={key} layer={key} pins={pins} />
          ) : null,
        )}
      </MapContainer>

      <LayerControl
        enabled={enabled}
        allowedAtZoom={allowed}
        onToggle={toggleLayer}
        proportionalTotal={proportionalTotal}
      />

      {/* 진단용 인디케이터 — visible state 확인 후 제거 */}
      <div className="absolute bottom-2 left-2 z-[1000] rounded bg-black/80 px-2 py-1 font-mono text-[10px] text-white">
        visible: [{[...visible].join(", ") || "비어있음"}]
      </div>
    </div>
  );
}
