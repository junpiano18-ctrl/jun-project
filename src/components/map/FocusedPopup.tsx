"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Popup, useMap } from "react-leaflet";
import { PoliticianCard } from "@/components/politician/PoliticianCard";
import type { PoliticianPin } from "@/lib/queries/politician-pins";
import type { LayerKey } from "@/lib/map/layers";

// `?focus=<routeId>`로 들어왔을 때 해당 핀으로 flyTo + popup + 그 핀의 layer만 활성화.
// 사용자가 popup을 닫으면 `shown=false`로 영구 dismiss — 이후 체크박스 토글로 리렌더돼도 popup 안 뜸.
// 새로운 focus URL이면 shown 다시 true로 reset.
type Props = {
  pins: PoliticianPin[];
  onFocus?: (layer: LayerKey) => void;
};

export function FocusedPopup({ pins, onFocus }: Props) {
  const params = useSearchParams();
  const focus = params.get("focus");
  const map = useMap();
  const focused = focus ? pins.find((p) => p.routeId === focus) : null;
  const handledRef = useRef<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // URL focus 변경에 따라 popup 표시/숨김 + flyTo. 본질적으로 effect-driven 상태.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!focused) {
      handledRef.current = null;
      setShown(false);
      return;
    }
    // 같은 focus는 한 번만 트리거 (체크박스 토글 등 리렌더에 영향 안 받음)
    if (handledRef.current === focused.routeId) return;
    handledRef.current = focused.routeId;
    setShown(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    map.flyTo([focused.lat, focused.lng], 12, { duration: 0.9 });
    onFocus?.(focused.layer);
  }, [focused, map, onFocus]);

  if (!focused || !shown) return null;
  return (
    <Popup
      position={[focused.lat, focused.lng]}
      eventHandlers={{
        // 사용자가 닫으면 영구 dismiss
        remove: () => setShown(false),
      }}
    >
      <PoliticianCard pin={focused} />
    </Popup>
  );
}
