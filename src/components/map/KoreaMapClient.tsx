"use client";

// Next.js 16부터 Server Component에서 `dynamic(..., { ssr: false })`이 금지됐다.
// react-leaflet은 모듈 로드 시 window에 접근하므로 SSR을 꼭 꺼야 한다.
// 따라서 이 클라이언트 래퍼 안에서 KoreaMap을 dynamic import한다.

import dynamic from "next/dynamic";
import type { PoliticianPin } from "@/lib/queries/politician-pins";

type KoreaMapProps = {
  pins: PoliticianPin[];
  proportionalTotal: number;
};

const KoreaMap = dynamic<KoreaMapProps>(() => import("./KoreaMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-zinc-500">
      지도를 불러오는 중…
    </div>
  ),
});

export default KoreaMap;
