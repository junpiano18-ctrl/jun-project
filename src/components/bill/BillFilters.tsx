"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BillFilter } from "@/lib/queries/bills";

const DEBOUNCE_MS = 250;

export function BillFilters({
  initialQ,
  initialFilter,
}: {
  initialQ: string;
  initialFilter: BillFilter;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [, startTransition] = useTransition();
  const filter = (sp.get("filter") as BillFilter) || initialFilter || "all";

  // 디바운스 후 URL 업데이트
  useEffect(() => {
    if (q === initialQ) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      next.delete("page");
      startTransition(() => router.replace(`/bills?${next.toString()}`));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setFilter(next: BillFilter) {
    const params = new URLSearchParams(sp.toString());
    if (next === "all") params.delete("filter");
    else params.set("filter", next);
    params.delete("page");
    startTransition(() => router.replace(`/bills?${params.toString()}`));
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="법안명으로 검색 (예: 최저임금, 주택)"
        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
      />
      <div className="flex gap-2">
        {(["all", "passed", "rejected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === f
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {f === "all" ? "전체" : f === "passed" ? "통과" : "부결"}
          </button>
        ))}
      </div>
    </div>
  );
}
