"use client";

import { useEffect } from "react";
import { useMapEvents } from "react-leaflet";

// MapContainer 자식으로 마운트되어 현재 줌 레벨을 부모로 전달한다.
// useMapEvents는 MapContainer 컨텍스트 안에서만 동작.
export function ZoomTracker({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  return null;
}
