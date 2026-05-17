"use client";

import { useState } from "react";

type Props = {
  name: string;
  partyColor: string;
  photoUrl?: string | null;
  size?: number; // pixel (정사각형)
  showCredit?: boolean;
  className?: string;
  shape?: "square" | "circle";
};

// 사진 URL 도메인으로 출처 자동 감지. 모르면 빈 문자열.
function creditFor(url: string | null | undefined): string {
  if (!url) return "";
  if (url.includes("wikimedia.org") || url.includes("wikipedia.org")) {
    return "© Wikimedia Commons";
  }
  if (url.includes("assembly.go.kr")) {
    return "© 대한민국 국회";
  }
  return "";
}

// HEX 색을 살짝 어둡게 — fallback 그라데이션의 하단 색.
function darken(hex: string, factor = 0.65): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// 의원 사진 컴포넌트.
// - photoUrl 있으면 이미지, 없거나 로딩 실패면 정당색 그라데이션 + 이름 첫 글자.
// - showCredit=true일 때 사진 아래에 작은 회색 출처 텍스트(© Wikimedia Commons 등).
// - fallback일 때는 같은 자리를 빈 문자열로 두어 카드 레이아웃 높이 통일.
export function PoliticianPhoto({
  name,
  partyColor,
  photoUrl,
  size = 96,
  showCredit = false,
  className,
  shape = "square",
}: Props) {
  const [errored, setErrored] = useState(false);
  const useFallback = !photoUrl || errored;
  const initial = name.slice(0, 1);
  const fontSize = Math.round(size * 0.46);
  const gradient = `linear-gradient(135deg, ${partyColor} 0%, ${darken(partyColor)} 100%)`;
  const creditText = !useFallback ? creditFor(photoUrl) : "";
  const radiusClass = shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <div className={`inline-flex flex-none flex-col ${className ?? ""}`}>
      <div
        className={`overflow-hidden ${radiusClass} ring-1 ring-zinc-200 dark:ring-zinc-800`}
        style={{ width: size, height: size }}
      >
        {useFallback ? (
          <div
            className="flex h-full w-full items-center justify-center font-bold text-white"
            style={{ background: gradient, fontSize }}
            aria-label={`${name} (사진 없음)`}
          >
            {initial}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl ?? undefined}
            alt={`${name} 의원 사진`}
            width={size}
            height={size}
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* 출처 자리 — 사진 있을 때만 텍스트, fallback은 빈 칸(높이 유지) */}
      {showCredit && (
        <p
          aria-hidden={!creditText}
          className="mt-1.5 leading-none"
          style={{ fontSize: 10, color: "#9CA3AF", minHeight: 12 }}
        >
          {creditText || " "}
        </p>
      )}
    </div>
  );
}
