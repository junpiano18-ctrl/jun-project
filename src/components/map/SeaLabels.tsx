"use client";

import L from "leaflet";
import { useMemo } from "react";
import { Marker } from "react-leaflet";

// 동해·독도 텍스트 오버레이. 타일이 "일본해" 또는 영문만 표시하더라도
// 우리 라벨이 그 위에 떠 한국어 + 영문 명칭을 보장한다.
// interactive=false라 클릭/호버 안 잡힘. 지도 인터랙션 방해 안 함.

const EAST_SEA_POSITION: [number, number] = [37.5, 130.5];
const DOKDO_POSITION: [number, number] = [37.2417, 131.8667];

export function SeaLabels() {
  const eastSeaIcon = useMemo(
    () =>
      L.divIcon({
        className: "sea-label-icon",
        html: `
          <div class="sea-label sea-label--east">
            <div class="sea-label__main">동해</div>
            <div class="sea-label__sub">East Sea</div>
          </div>
        `,
        iconSize: [120, 36],
        iconAnchor: [60, 18],
      }),
    [],
  );

  const dokdoIcon = useMemo(
    () =>
      L.divIcon({
        className: "sea-label-icon",
        html: `
          <div class="sea-label sea-label--island">
            <span class="sea-label__dot" aria-hidden="true"></span>
            <div>
              <div class="sea-label__main sea-label__main--sm">독도</div>
              <div class="sea-label__sub">Dokdo</div>
            </div>
          </div>
        `,
        iconSize: [80, 28],
        iconAnchor: [-6, 14],
      }),
    [],
  );

  return (
    <>
      <Marker position={EAST_SEA_POSITION} icon={eastSeaIcon} interactive={false} />
      <Marker position={DOKDO_POSITION} icon={dokdoIcon} interactive={false} />
    </>
  );
}
