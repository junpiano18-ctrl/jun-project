"use client";

import { useState } from "react";
import { formatElectionLabel } from "@/lib/format/election-label";

type Pledge = {
  id: string;
  category: string | null;
  title: string;
  originalText: string;
  easySummary: string | null;
  status: string | null;
  electionDate: Date | string | null;
};

// 공약 카드 — 원문 항상 표시 + "쉽게 보기" 토글로 AI 요약 노출.
// 1. 원문 (선관위 제출 공식 텍스트)
// 2. 출처 라벨
// 3. "쉽게 보기" 토글 (기본 닫힘)
// 4. 펼치면 AI 요약 + 면책 문구
export function PledgeCard({ pledge }: { pledge: Pledge }) {
  const [open, setOpen] = useState(false);
  const hasSummary = Boolean(pledge.easySummary);
  const electionLabel = formatElectionLabel(pledge.electionDate);

  return (
    <li className="rounded border border-zinc-200 p-3.5 dark:border-zinc-800">
      {/* 출처 선거 라벨 — 본문 위 작은 텍스트 */}
      {electionLabel && (
        <p className="mb-1.5 text-[11px] text-zinc-500">
          📅 {electionLabel} 당선 공약
        </p>
      )}

      {/* 헤더: 카테고리 + 제목 */}
      <div className="mb-2 flex items-baseline gap-2">
        {pledge.category && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {pledge.category}
          </span>
        )}
        <h3 className="text-sm font-semibold">{pledge.title}</h3>
      </div>

      {/* 1. 원문 — 항상 표시. 선관위 본문은 □ 목표 / □ 이행방법 등 줄바꿈이 의미 있어 pre-line으로. */}
      <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        {pledge.originalText}
      </p>
      <p className="mt-1.5 text-[11px] text-zinc-400">
        출처: 중앙선거관리위원회 제출 공약
      </p>

      {/* 2. AI 쉬운 말 요약 토글 (기본 닫힘) */}
      <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <span>쉽게 보기</span>
          <svg
            viewBox="0 0 12 12"
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </button>

        {open && (
          <div className="mt-3 rounded bg-zinc-50 p-3 dark:bg-zinc-900/60">
            {hasSummary ? (
              <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                {pledge.easySummary}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">
                AI 요약 준비 중이에요. 곧 중학생도 이해할 수 있는 쉬운 말로 정리해드릴게요.
              </p>
            )}
            {/* 3. 면책 문구 — 요약 펼쳤을 때만 표시 */}
            <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-500">
              ※ AI 요약은 이해를 돕기 위한 것이며, 선관위 제출 원문이 공식 공약입니다.
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
