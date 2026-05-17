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

// 768px 미만(모바일)에서는 ☰ 버튼만 보이고 패널은 슬라이드로 열림.
// 768px 이상(태블릿·데스크톱)에서는 항상 우상단 고정 패널.
export function LayerControl({
  enabled,
  allowedAtZoom,
  onToggle,
  proportionalTotal,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 모바일에서 패널 외부 클릭 시 닫기. mousedown으로 잡아 leaflet click과 충돌 최소화.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <>
      {/* 모바일 토글 버튼 — md 이상 숨김 */}
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "직급 패널 닫기" : "직급 패널 열기"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-4 top-4 z-[1001] flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-md transition hover:bg-zinc-50 md:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        {open ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
        )}
      </button>

      <div
        ref={panelRef}
        className={`absolute right-4 top-4 z-[1000] w-56 flex-col gap-2 rounded border border-zinc-200 bg-white p-3 text-xs shadow-sm transition-transform md:top-4 md:flex dark:border-zinc-800 dark:bg-zinc-950 ${
          open
            ? "top-16 flex translate-x-0"
            : "hidden translate-x-full md:translate-x-0"
        }`}
      >
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
                  className={`group flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left transition ${
                    l.available
                      ? "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3px] border transition ${
                      isEnabled
                        ? "border-transparent bg-zinc-800 dark:bg-zinc-200"
                        : "border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {isEnabled && (
                      <svg
                        viewBox="0 0 12 12"
                        className="h-2.5 w-2.5 text-white dark:text-zinc-900"
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

        <div className="mt-1 border-t border-zinc-100 pt-2 dark:border-zinc-900">
          <div className="flex items-center gap-2 px-1.5">
            <span
              aria-hidden
              className="flex h-4 w-4 flex-none items-center justify-center rounded-full border border-zinc-900 bg-white text-[8px] font-bold text-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100"
            >
              N
            </span>
            <span className="text-[11px] text-zinc-500">
              여러 명일 때 묶음 표시
            </span>
          </div>
        </div>

        <div className="mt-1 border-t border-zinc-100 pt-2 dark:border-zinc-900">
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
                <span className="text-zinc-700 dark:text-zinc-300">{p.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-1 border-t border-zinc-100 pt-2 dark:border-zinc-900">
          <Link
            href="/regions/proportional"
            className="flex items-center justify-between rounded px-1.5 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <span>비례대표 {proportionalTotal}명</span>
            <span className="text-zinc-400">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}
