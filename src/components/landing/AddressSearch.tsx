"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SearchPoliticianResult,
  SearchRegionResult,
} from "@/lib/queries/search";

type SearchResponse = {
  politicians: SearchPoliticianResult[];
  regions: SearchRegionResult[];
};

type Item =
  | { kind: "region"; data: SearchRegionResult }
  | { kind: "politician"; data: SearchPoliticianResult };

const DEBOUNCE_MS = 180;

export function AddressSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const [regions, setRegions] = useState<SearchRegionResult[]>([]);
  const [politicians, setPoliticians] = useState<SearchPoliticianResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  // 키보드 네비용 평탄화: 동네 → 의원 순. 첫 동네 매치를 1순위로.
  const items: Item[] = useMemo(
    () => [
      ...regions.map((r) => ({ kind: "region" as const, data: r })),
      ...politicians.map((p) => ({ kind: "politician" as const, data: p })),
    ],
    [regions, politicians],
  );

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (composing) return;
    const q = value.trim();
    if (!q) {
      setRegions([]);
      setPoliticians([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: SearchResponse) => {
          setRegions(data.regions ?? []);
          setPoliticians(data.politicians ?? []);
          setFocusedIdx(-1);
        })
        .catch((e) => {
          if ((e as Error).name !== "AbortError") console.error(e);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [value, composing]);

  function go(item: Item) {
    setOpen(false);
    inputRef.current?.blur();
    if (item.kind === "region") {
      router.push(`/my-reps?adm=${item.data.admCd}`);
    } else {
      router.push(`/politicians/${item.data.monaCd}`);
    }
  }

  function onSubmit() {
    if (items.length === 0) return;
    const pick = focusedIdx >= 0 ? items[focusedIdx] : items[0];
    if (pick) go(pick);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (composing) return;
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  }

  const showDropdown = open && value.trim().length > 0;
  const empty = !loading && items.length === 0;
  const submitLabel =
    items.length > 0 && (focusedIdx >= 0 ? items[focusedIdx] : items[0]).kind === "politician"
      ? "의원 정보 보기 →"
      : "우리 동네 일꾼 보기 →";

  let runningIdx = -1;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 shadow-sm transition focus-within:border-zinc-900 focus-within:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-100">
        <span aria-hidden className="text-lg text-zinc-400">🔍</span>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => {
            setComposing(false);
            setValue((e.target as HTMLInputElement).value);
          }}
          onKeyDown={onKeyDown}
          placeholder="동네 또는 의원 이름  예) 마포구, 정청래"
          aria-label="동네 또는 의원 검색"
          className="w-full bg-transparent text-base outline-none placeholder:text-zinc-400 sm:text-lg"
        />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={items.length === 0}
        className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
      >
        {submitLabel}
      </button>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[64px] z-20 mt-1 max-h-[420px] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {loading && (
            <div className="px-4 py-3 text-sm text-zinc-400">검색 중…</div>
          )}

          {!loading && regions.length > 0 && <SectionHeader>동네</SectionHeader>}
          {!loading && regions.map((r) => {
            runningIdx++;
            const idx = runningIdx;
            return (
              <button
                key={`r-${r.admCd}-${idx}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go({ kind: "region", data: r }); }}
                onMouseEnter={() => setFocusedIdx(idx)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                  idx === focusedIdx
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span aria-hidden className="mt-1 text-zinc-300">📍</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-zinc-500">
                    {r.sidonm} {r.sggnm}
                  </div>
                  <div className="truncate text-base font-medium">
                    {r.dongName}
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && politicians.length > 0 && <SectionHeader>의원</SectionHeader>}
          {!loading && politicians.map((p) => {
            runningIdx++;
            const idx = runningIdx;
            return (
              <button
                key={`p-${p.monaCd}-${idx}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go({ kind: "politician", data: p }); }}
                onMouseEnter={() => setFocusedIdx(idx)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  idx === focusedIdx
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ backgroundColor: p.party?.color ?? "#a1a1aa" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium">{p.name}</span>
                    {p.isProportional && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">
                        비례
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {p.party?.name ?? "무소속"} · {p.districtName}
                  </div>
                </div>
              </button>
            );
          })}

          {empty && (
            <div className="px-4 py-4 text-sm text-zinc-500">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                &quot;{value}&quot; 결과가 없어요.
              </p>
              <p className="mt-1 text-zinc-400">
                동 이름(예: 합정동), 시군구(예: 마포구), 또는 의원 이름(예: 정청래)을 입력해 보세요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-1.5 text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900">
      {children}
    </div>
  );
}
