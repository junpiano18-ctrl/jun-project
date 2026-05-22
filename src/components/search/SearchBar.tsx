"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SearchBillResult,
  SearchPoliticianResult,
  SearchRegionResult,
} from "@/lib/queries/search";

type SearchResponse = {
  politicians: SearchPoliticianResult[];
  regions: SearchRegionResult[];
  bills: SearchBillResult[];
};

type FlatItem =
  | { kind: "politician"; data: SearchPoliticianResult }
  | { kind: "region"; data: SearchRegionResult }
  | { kind: "bill"; data: SearchBillResult };

const BILL_STATUS_TAG: Record<"PENDING" | "PASSED" | "REJECTED", string> = {
  PENDING: "심사 중",
  PASSED: "통과",
  REJECTED: "처리 안 됨",
};

const DEBOUNCE_MS = 180;

export function SearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const [results, setResults] = useState<SearchResponse>({ politicians: [], regions: [], bills: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [toast, setToast] = useState<string | null>(null);

  // 키보드 네비 인덱스용 평탄화
  const items: FlatItem[] = useMemo(() => {
    return [
      ...results.politicians.map((p) => ({ kind: "politician" as const, data: p })),
      ...results.regions.map((r) => ({ kind: "region" as const, data: r })),
      ...results.bills.map((b) => ({ kind: "bill" as const, data: b })),
    ];
  }, [results]);

  // "/" 단축키
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // debounced fetch (한글 IME 조합 중 보류)
  useEffect(() => {
    if (composing) return;
    const q = value.trim();
    if (!q) {
      setResults({ politicians: [], regions: [], bills: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: SearchResponse) => {
          setResults(data);
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

  function goItem(item: FlatItem) {
    if (item.kind === "bill") {
      setOpen(false);
      setValue("");
      setResults({ politicians: [], regions: [], bills: [] });
      inputRef.current?.blur();
      window.open(item.data.billUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const monaCd =
      item.kind === "politician" ? item.data.monaCd : item.data.politician?.monaCd;
    if (!monaCd) return;
    setOpen(false);
    setValue("");
    setResults({ politicians: [], regions: [], bills: [] });
    inputRef.current?.blur();

    // 이름 검색 비례대표는 지역구 좌표가 없으므로 지도 focus 대신 안내 후 상세로.
    const isProportional =
      (item.kind === "politician" && item.data.isProportional) ||
      (item.kind === "region" && item.data.politician?.isProportional);

    if (isProportional) {
      setToast("비례대표 의원입니다. 상세 페이지로 이동합니다.");
      setTimeout(() => {
        setToast(null);
        router.push(`/politicians/${monaCd}`);
      }, 900);
      return;
    }

    // 이름 / 동네 검색 모두 → 지도 focus. FocusedPopup이 flyTo + popup 처리.
    router.push(`/map?focus=${monaCd}`);
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
      const pick = focusedIdx >= 0 ? items[focusedIdx] : items[0];
      if (pick) goItem(pick);
    }
  }

  const showDropdown = open && value.trim().length > 0;
  const empty = !loading && items.length === 0;
  let runningIdx = -1;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-sm">
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-[3000] -translate-x-1/2 rounded-md bg-zinc-900/95 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100/95 dark:text-zinc-900">
          {toast}
        </div>
      )}
      <input
        ref={inputRef}
        type="search"
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
        placeholder="동네·의원·법안 검색  /"
        aria-label="동네·의원·법안 검색"
        className="w-full rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-[2000] mt-1 max-h-96 overflow-y-auto rounded border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-950">
          {loading && (
            <div className="px-3 py-2 text-xs text-zinc-400">검색 중…</div>
          )}

          {!loading && results.politicians.length > 0 && (
            <SectionHeader>의원</SectionHeader>
          )}
          {!loading && results.politicians.map((p) => {
            runningIdx++;
            const idx = runningIdx;
            return (
              <button
                key={`p-${p.monaCd}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); goItem({ kind: "politician", data: p }); }}
                onMouseEnter={() => setFocusedIdx(idx)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                  idx === focusedIdx ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span aria-hidden className="h-2 w-2 flex-none rounded-full"
                  style={{ backgroundColor: p.party?.color ?? "#888888" }} />
                <span className="font-medium">{p.name}</span>
                {p.isProportional && (
                  <span className="rounded bg-zinc-100 px-1 py-px text-[10px] text-zinc-500 dark:bg-zinc-800">
                    비례
                  </span>
                )}
                <span className="truncate text-xs text-zinc-500">{p.districtName}</span>
                <span className="ml-auto text-xs text-zinc-400">
                  {p.party?.name ?? "무소속"}
                </span>
              </button>
            );
          })}

          {!loading && results.regions.length > 0 && (
            <SectionHeader>동네</SectionHeader>
          )}
          {!loading && results.regions.map((r, i) => {
            runningIdx++;
            const idx = runningIdx;
            const disabled = !r.politician;
            return (
              <button
                key={`r-${i}`}
                type="button"
                disabled={disabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!disabled) goItem({ kind: "region", data: r });
                }}
                onMouseEnter={() => !disabled && setFocusedIdx(idx)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                  disabled ? "cursor-not-allowed opacity-60" : ""
                } ${
                  idx === focusedIdx && !disabled
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span aria-hidden className="h-2 w-2 flex-none rounded-full"
                  style={{ backgroundColor: r.politician?.party?.color ?? "#d4d4d8" }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">
                    <span className="text-xs text-zinc-400">{r.sidonm} {r.sggnm} </span>
                    <span className="font-medium">{r.dongName}</span>
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {r.districtName} {r.politician ? `· ${r.politician.name}` : "· 공석"}
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && results.bills.length > 0 && (
            <SectionHeader>법안</SectionHeader>
          )}
          {!loading && results.bills.map((b, i) => {
            runningIdx++;
            const idx = runningIdx;
            return (
              <button
                key={`b-${b.billId}-${i}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); goItem({ kind: "bill", data: b }); }}
                onMouseEnter={() => setFocusedIdx(idx)}
                className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition ${
                  idx === focusedIdx
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span aria-hidden className="mt-0.5 text-sm">📋</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{b.billName}</div>
                  {b.summary && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">
                      💬 {b.summary}
                    </p>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                    {b.politician && (
                      <>
                        <span aria-hidden className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: b.politician.party?.color ?? "#a1a1aa" }} />
                        <span>{b.politician.name}</span>
                      </>
                    )}
                    <span className="rounded-full bg-zinc-100 px-1.5 py-px text-[10px] dark:bg-zinc-800">
                      {BILL_STATUS_TAG[b.billStatus]}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {empty && (
            <div className="px-3 py-3 text-xs text-zinc-500">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                &quot;{value}&quot;에 해당하는 결과가 없어요.
              </p>
              <p className="mt-1 text-zinc-400">
                동네(예: 마포구), 의원(예: 정청래), 법안 키워드(예: 최저임금)를 입력해 보세요.
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
    <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-1 text-[10px] uppercase tracking-widest text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900">
      {children}
    </div>
  );
}
