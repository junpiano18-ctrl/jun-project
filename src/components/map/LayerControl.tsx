"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LAYERS, PARTY_LEGEND, type LayerKey } from "@/lib/map/layers";
import { smallShapeSvg } from "@/lib/map/pin-icon";

type Props = {
  enabled: Set<LayerKey>;
  allowedAtZoom: Set<LayerKey>;
  onToggle: (key: LayerKey) => void;
  proportionalTotal: number;
};

// 데스크톱(≥md): 우상단 고정 패널.
// 모바일(<md): 하단 thin bar(48px)만 기본 노출 — 직급 dot 한 줄. 탭하면 하단에서 시트가 올라옴.
export function LayerControl({
  enabled,
  allowedAtZoom,
  onToggle,
  proportionalTotal,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 모바일 시트 외부(backdrop) 탭 시 닫기는 backdrop onClick에서 처리. body 스크롤 잠금까지는 안 함.
  // ESC로도 닫기.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 패널 본문 — 데스크톱과 모바일 시트 양쪽에서 동일하게 렌더.
  const panelBody = (
    <>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        직급 (모양)
      </div>
      <ul className="flex flex-col">
        {LAYERS.map((l) => {
          const isEnabled = enabled.has(l.key);
          const allowedNow = allowedAtZoom.has(l.key);
          const masked = isEnabled && !allowedNow;
          const shapeHtml = smallShapeSvg(
            l.shape,
            l.available && isEnabled ? "#27272A" : "#A1A1AA",
          );
          return (
            <li key={l.key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isEnabled}
                onClick={() => l.available && onToggle(l.key)}
                disabled={!l.available}
                className={`group flex w-full items-center gap-2 rounded px-1.5 py-2 text-left transition ${
                  l.available
                    ? "hover:bg-zinc-50"
                    : "cursor-not-allowed opacity-50"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border transition ${
                    isEnabled
                      ? "border-transparent bg-zinc-800"
                      : "border-zinc-300"
                  }`}
                >
                  {isEnabled && (
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.5 6.5L5 9l4.5-5.5" />
                    </svg>
                  )}
                </span>

                <span
                  aria-hidden
                  className="inline-flex h-4 w-4 flex-none items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: shapeHtml }}
                />

                <span className={isEnabled ? "font-medium" : "text-zinc-500"}>
                  {l.label}
                </span>

                <span className="ml-auto text-[10px] text-zinc-400">
                  {!l.available ? "준비 중" : masked ? "줌 조정" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 border-t border-zinc-100 pt-2">
        <div className="flex items-center gap-2 px-1.5">
          <span
            aria-hidden
            className="flex h-4 w-4 flex-none items-center justify-center rounded-full border border-zinc-900 bg-white text-[8px] font-bold text-zinc-900"
          >
            N
          </span>
          <span className="text-[11px] text-zinc-500">여러 명일 때 묶음 표시</span>
        </div>
      </div>

      <div className="mt-1 border-t border-zinc-100 pt-2">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          정당 (색깔)
        </div>
        <ul className="flex flex-col gap-1">
          {PARTY_LEGEND.map((p) => (
            <li key={p.name} className="flex items-center gap-2 px-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-zinc-700">{p.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-1 border-t border-zinc-100 pt-2">
        <Link
          href="/regions/proportional"
          className="flex items-center justify-between rounded px-1.5 py-2 text-xs text-zinc-700 transition hover:bg-zinc-50"
        >
          <span>비례대표 {proportionalTotal}명</span>
          <span className="text-zinc-400">→</span>
        </Link>
      </div>
    </>
  );

  // 모바일 thin bar에 보일 직급 dot(available만).
  const barLayers = LAYERS.filter((l) => l.available);

  return (
    <>
      {/* ─── 데스크톱: 우상단 고정 패널 ─── */}
      <div
        ref={panelRef}
        className="absolute right-4 top-4 z-[1000] hidden w-56 flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-sm md:flex"
      >
        {panelBody}
      </div>

      {/* ─── 모바일: 하단 thin bar (48px) ─── */}
      <button
        type="button"
        aria-label="직급 패널 열기"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="absolute inset-x-0 bottom-0 z-[1000] flex h-12 items-center gap-3 border-t border-zinc-200 bg-white px-4 text-xs shadow-[0_-2px_8px_rgba(0,0,0,0.04)] md:hidden"
      >
        {barLayers.map((l) => {
          const on = enabled.has(l.key);
          return (
            <span
              key={l.key}
              className={`flex items-center gap-1 ${on ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: on ? "#7C3AED" : "#D4D4D8" }}
              />
              {l.label}
            </span>
          );
        })}
        <span aria-hidden className="ml-auto text-zinc-400">
          ▲
        </span>
      </button>

      {/* ─── 모바일: backdrop + slide-up 시트 ─── */}
      {open && (
        <div className="absolute inset-0 z-[1001] md:hidden">
          {/* backdrop — 탭하면 닫힘 */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* sheet */}
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200" aria-hidden />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900">지도 범례</h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2 text-xs">{panelBody}</div>
          </div>
        </div>
      )}
    </>
  );
}
