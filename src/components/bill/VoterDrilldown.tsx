"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Voter } from "@/app/api/bills/[billId]/voters/route";

export type VoteResult = "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT";

const RESULT_META: Record<VoteResult, { icon: string; label: string; toneClass: string }> = {
  AGREE:    { icon: "✅", label: "찬성", toneClass: "text-emerald-700" },
  DISAGREE: { icon: "❌", label: "반대", toneClass: "text-rose-700" },
  ABSTAIN:  { icon: "🟡", label: "기권", toneClass: "text-amber-700" },
  ABSENT:   { icon: "⚫", label: "불참", toneClass: "text-zinc-500" },
};

// 표결 카운트 라벨 + 클릭 시 의원 목록 펼치는 토글.
// 그룹 안에서 여러 버튼이 panel을 공유하는 경우, 부모가 active 상태 관리.
type ButtonProps = {
  result: VoteResult;
  count: number;
  active: boolean;
  onClick: () => void;
  /** 라벨 텍스트 override (예: "찬성 176명" 대신 "찬성 176") */
  labelOverride?: string;
  /** 추가 클래스 */
  className?: string;
};

export function VoterDrilldownButton({
  result,
  count,
  active,
  onClick,
  labelOverride,
  className,
}: ButtonProps) {
  const m = RESULT_META[result];
  // 모바일: 최소 hit area 44x44 (iOS HIG). 데스크톱: 살짝 컴팩트.
  // stopPropagation으로 상위 카드/시트 click 이벤트와 충돌 방지.
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={active}
      className={`inline-flex min-h-11 items-center gap-1 rounded-md border border-transparent px-3 py-2 transition active:scale-[0.98] md:min-h-7 md:px-2 md:py-1 ${
        active ? "border-zinc-300 bg-zinc-100" : "hover:bg-zinc-50"
      } ${m.toneClass} ${className ?? ""}`}
    >
      <span aria-hidden>{m.icon}</span>
      <span>{labelOverride ?? `${m.label} ${count}명`}</span>
      <span aria-hidden className={`text-[10px] transition-transform ${active ? "rotate-180" : ""}`}>
        ▼
      </span>
    </button>
  );
}

// 의원 목록 패널 — billId·result(+partyId)로 fetch + 렌더. 캐시: 같은 키 재호출 안 함.
type PanelProps = {
  billId: string;
  result: VoteResult;
  partyId?: string;
  title: string; // "✅ 찬성 176명" 같은 헤더
};

export function VoterListPanel({ billId, result, partyId, title }: PanelProps) {
  const [voters, setVoters] = useState<Voter[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // billId/result/partyId가 바뀌면 재fetch. 같은 키엔 1회.
  useEffect(() => {
    const ctrl = new AbortController();
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    setVoters(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const qs = new URLSearchParams({ voteResult: result });
    if (partyId) qs.set("partyId", partyId);
    fetch(`/api/bills/${billId}/voters?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { voters: Voter[] }) => {
        setVoters(data.voters);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [billId, result, partyId]);

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="mb-2 text-xs font-semibold text-zinc-700">{title}</p>
      {loading && (
        <div className="flex items-center gap-2 py-3 text-xs text-zinc-500">
          <Spinner /> 의원 목록을 불러오는 중…
        </div>
      )}
      {error && (
        <p className="py-2 text-xs text-rose-600">불러오기 실패: {error}</p>
      )}
      {!loading && !error && voters && voters.length === 0 && (
        <p className="py-2 text-xs text-zinc-500">해당 결과의 의원이 없습니다.</p>
      )}
      {!loading && !error && voters && voters.length > 0 && (
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {voters.map((v, i) => (
            <li key={`${v.monaCd ?? v.name}-${i}`}>
              {v.monaCd ? (
                <Link
                  href={`/politicians/${v.monaCd}`}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-zinc-700 hover:bg-white"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 flex-none rounded-full"
                    style={{ backgroundColor: v.partyColor ?? "#a1a1aa" }}
                  />
                  <span className="font-medium text-zinc-900">{v.name}</span>
                  <span className="truncate text-zinc-500">· {v.districtName}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-zinc-700">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 flex-none rounded-full"
                    style={{ backgroundColor: v.partyColor ?? "#a1a1aa" }}
                  />
                  <span className="font-medium text-zinc-900">{v.name}</span>
                  <span className="truncate text-zinc-500">· {v.districtName}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
    />
  );
}

// 그룹 — 한 row의 여러 버튼 + 1개 panel을 묶어 관리.
type GroupItem = {
  result: VoteResult;
  count: number;
  labelOverride?: string;
};

export function VoterDrilldownGroup({
  billId,
  partyId,
  partyName,
  items,
  className,
}: {
  billId: string;
  partyId?: string;
  /** 정당 컨텍스트 — panel 제목에 사용 (없으면 전체 표결) */
  partyName?: string;
  items: GroupItem[];
  className?: string;
}) {
  const [active, setActive] = useState<VoteResult | null>(null);

  const toggle = useCallback((r: VoteResult) => {
    setActive((cur) => (cur === r ? null : r));
  }, []);

  const activeItem = items.find((i) => i.result === active);
  const m = active ? RESULT_META[active] : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((it, idx) => (
          <span key={it.result} className="contents">
            <VoterDrilldownButton
              result={it.result}
              count={it.count}
              active={active === it.result}
              onClick={() => toggle(it.result)}
              labelOverride={it.labelOverride}
            />
            {idx < items.length - 1 && (
              <span aria-hidden className="text-zinc-300">·</span>
            )}
          </span>
        ))}
      </div>
      {active && m && activeItem && (
        <VoterListPanel
          billId={billId}
          result={active}
          partyId={partyId}
          title={`${m.icon} ${partyName ? `${partyName} ` : ""}${m.label} ${activeItem.count}명`}
        />
      )}
    </div>
  );
}
