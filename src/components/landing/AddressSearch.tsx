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

type Item =
  | { kind: "region"; data: SearchRegionResult }
  | { kind: "politician"; data: SearchPoliticianResult }
  | { kind: "bill"; data: SearchBillResult };

const BILL_STATUS_TAG: Record<"PENDING" | "PASSED" | "REJECTED", string> = {
  PENDING: "심사 중",
  PASSED: "통과",
  REJECTED: "처리 안 됨",
};

const DEBOUNCE_MS = 180;

// 편향 시비 방지를 위해 의원 이름은 제외, 동네명만 예시로 회전.
const DONG_EXAMPLES = [
  "행신동", "성산동", "해운대동",
  "서면동", "신촌동", "둔산동",
  "평촌동", "일산동", "분당동",
  "광안동", "유성동", "달서동",
];

export function AddressSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const [regions, setRegions] = useState<SearchRegionResult[]>([]);
  const [politicians, setPoliticians] = useState<SearchPoliticianResult[]>([]);
  const [bills, setBills] = useState<SearchBillResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  // SSR 안정성을 위해 첫 렌더는 고정값, 마운트 후 랜덤 교체 → hydration mismatch 회피.
  const [placeholderDong, setPlaceholderDong] = useState(DONG_EXAMPLES[0]);
  useEffect(() => {
    // SSR/CSR 불일치 방지를 위해 마운트 후에만 랜덤화 — useState 초기값에 넣으면 hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaceholderDong(DONG_EXAMPLES[Math.floor(Math.random() * DONG_EXAMPLES.length)]);
  }, []);

  // 키보드 네비용 평탄화: 동네 → 의원 → 법안 순.
  const items: Item[] = useMemo(
    () => [
      ...regions.map((r) => ({ kind: "region" as const, data: r })),
      ...politicians.map((p) => ({ kind: "politician" as const, data: p })),
      ...bills.map((b) => ({ kind: "bill" as const, data: b })),
    ],
    [regions, politicians, bills],
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
      // 빈 쿼리 시 결과 비우기 — debounced fetch의 cleanup 성격. effect 외부에서 처리하기 어려움.
      /* eslint-disable react-hooks/set-state-in-effect */
      setRegions([]);
      setPoliticians([]);
      setBills([]);
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
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
          setBills(data.bills ?? []);
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
    } else if (item.kind === "politician") {
      router.push(`/politicians/${item.data.routeId}`);
    } else {
      // 법안 → 내부 상세 페이지. 외부 의안정보시스템 링크는 상세 페이지 안에서 제공.
      router.push(`/bills/${item.data.billId}`);
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
  // submit은 Enter 키 또는 드롭다운 항목 클릭으로 처리 (큰 버튼 제거됨).

  let runningIdx = -1;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-[#7C3AED] focus-within:shadow-md focus-within:ring-2 focus-within:ring-[#EDE9FE]">
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
          placeholder={`우리 동네 입력 (예: ${placeholderDong})`}
          aria-label="동네·의원·법안 검색"
          className="w-full bg-transparent text-base outline-none placeholder:text-zinc-400 sm:text-lg"
        />
      </div>

      {/* 큰 submit 버튼은 제거 — 검색은 자동완성 드롭다운 선택 또는 Enter 키로 처리. */}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[64px] z-20 mt-1 max-h-[420px] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {loading && (
            <div className="px-4 py-3 text-sm text-zinc-400">검색 중…</div>
          )}

          {!loading && regions.length > 0 && <SectionHeader>🏘️ 동네</SectionHeader>}
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

          {!loading && politicians.length > 0 && <SectionHeader>👤 의원</SectionHeader>}
          {!loading && politicians.map((p) => {
            runningIdx++;
            const idx = runningIdx;
            return (
              <button
                key={`p-${p.routeId}-${idx}`}
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
                    {p.positionTitle} · {p.party?.name ?? "무소속"} · {p.districtName}
                  </div>
                </div>
              </button>
            );
          })}

          {!loading && bills.length > 0 && <SectionHeader>📋 법안</SectionHeader>}
          {!loading && bills.map((b) => {
            runningIdx++;
            const idx = runningIdx;
            return (
              <button
                key={`b-${b.billId}-${idx}`}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go({ kind: "bill", data: b }); }}
                onMouseEnter={() => setFocusedIdx(idx)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                  idx === focusedIdx
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span aria-hidden className="mt-0.5 text-base">📋</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{b.billName}</div>
                  {b.summary && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      💬 {b.summary}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                    {b.politician && (
                      <>
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: b.politician.party?.color ?? "#a1a1aa" }}
                        />
                        <span>{b.politician.name}</span>
                      </>
                    )}
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">
                      {BILL_STATUS_TAG[b.billStatus]}
                    </span>
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
                동네(예: 마포구), 의원(예: 정청래), 또는 법안 키워드(예: 최저임금)를 입력해 보세요.
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
