"use client";

import L from "leaflet";
import { Marker, Popup, Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { PoliticianCard } from "@/components/politician/PoliticianCard";
import { LAYERS, type LayerKey } from "@/lib/map/layers";
import { makePinHtml } from "@/lib/map/pin-icon";
import type { PoliticianPin } from "@/lib/queries/politician-pins";

// 핀: 직급=모양 + 정당=색.
// vacant(상실·정지·사망): 회색.

type Props = {
  layer: LayerKey;
  pins: PoliticianPin[];
};

const iconCache = new Map<string, L.DivIcon>();

function makeIcon(layer: LayerKey, color: string, vacant: boolean): L.DivIcon {
  const layerDef = LAYERS.find((l) => l.key === layer)!;
  const fillColor = vacant ? "#9CA3AF" : color;
  const key = `${layer}|${fillColor}|${vacant ? "v" : "a"}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "politician-pin",
    html: makePinHtml(layerDef.shape, layerDef.size, fillColor),
    iconSize: [layerDef.size, layerDef.size],
    iconAnchor: [layerDef.size / 2, layerDef.size / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

// 클러스터: 정당/직급 색과 무관한 중립 디자인 — 흰 배경 + 검정 테두리 + 검정 숫자.
// 핀(20~24px)보다 크게(40px). title 속성으로 호버 툴팁.
function makeClusterIcon() {
  return (cluster: L.MarkerCluster) => {
    const count = cluster.getChildCount();
    return L.divIcon({
      className: "politician-cluster",
      html: `<span class="politician-cluster__bubble" title="이 지역 ${count}명 보기">${count}</span>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };
}

export function LayerPinGroup({ layer, pins }: Props) {
  const layerPins = pins.filter((p) => p.layer === layer);
  if (layerPins.length === 0) return null;

  return (
    <MarkerClusterGroup
      chunkedLoading
      disableClusteringAtZoom={12}
      spiderfyOnMaxZoom={false}
      showCoverageOnHover={false}
      maxClusterRadius={50}
      iconCreateFunction={makeClusterIcon()}
    >
      {layerPins.map((p) => {
        const vacant = Boolean(p.status) && p.status !== "ACTIVE";
        // 정당색 우선. 정당 없으면 무소속 회색.
        const color = p.party?.color ?? "#888888";
        return (
          <Marker
            key={`${layer}-${p.routeId}`}
            position={[p.lat, p.lng]}
            icon={makeIcon(layer, color, vacant)}
            eventHandlers={{
              // 모바일 ghost click — touchend 후 발생하는 click이 map으로 전파돼
              // popup이 즉시 닫히는 현상 차단.
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <strong>{p.name}</strong>
              {vacant && <span style={{ color: "#a1a1aa" }}> · 현재 공석</span>}{" "}
              · {p.districtName}
            </Tooltip>
            <Popup
              // closeOnClick=true(기본)면 map click 때 닫힘. ghost click과 충돌.
              // 닫기는 ✕ 버튼이나 다른 핀 탭(autoClose=true 기본)으로만.
              closeOnClick={false}
              autoClose={true}
            >
              <PoliticianCard pin={p} />
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}
