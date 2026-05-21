"use client";

import { useState } from "react";

const INITIAL_VISIBLE = 3;

export function CareerList({ lines }: { lines: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (lines.length === 0) return null;

  const total = lines.length;
  const collapsible = total > INITIAL_VISIBLE;
  const visible = expanded || !collapsible ? lines : lines.slice(0, INITIAL_VISIBLE);

  return (
    <>
      <ul className="space-y-1.5 text-sm text-zinc-200">
        {visible.map((line, i) => (
          <li key={i} className="leading-snug">
            {line}
          </li>
        ))}
      </ul>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white"
        >
          {expanded ? "접기 ▲" : `경력 전체 보기 (${total}개) ▼`}
        </button>
      )}
    </>
  );
}
