"use client";

import { useMemo, useState } from "react";

const BILL_STATUS_META: Record<
  "PENDING" | "PASSED" | "REJECTED",
  { icon: string; label: string }
> = {
  PENDING: { icon: "🟡", label: "심사 중이에요" },
  PASSED: { icon: "🟢", label: "통과됐어요" },
  REJECTED: { icon: "🔴", label: "처리 안 됐어요" },
};

export type BillRow = {
  id: string;
  billName: string;
  billStatus: "PENDING" | "PASSED" | "REJECTED";
  proposedAt: Date | string | null;
  billUrl: string;
  summary: string | null;
};

type Group = {
  yearKey: number | null; // null = 연도 미상
  yearLabel: string;
  bills: BillRow[];
};

function toYear(d: Date | string | null): number | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
}

function groupByYear(bills: BillRow[]): Group[] {
  const buckets = new Map<number | null, BillRow[]>();
  for (const b of bills) {
    const y = toYear(b.proposedAt);
    const arr = buckets.get(y) ?? [];
    arr.push(b);
    buckets.set(y, arr);
  }
  const groups: Group[] = [];
  // 연도 있는 그룹: 내림차순. 연도 미상은 맨 뒤.
  const sortedYears = [...buckets.keys()]
    .filter((y): y is number => y !== null)
    .sort((a, b) => b - a);
  for (const y of sortedYears) {
    groups.push({
      yearKey: y,
      yearLabel: `${y}년`,
      bills: buckets.get(y)!,
    });
  }
  if (buckets.has(null)) {
    groups.push({
      yearKey: null,
      yearLabel: "연도 미상",
      bills: buckets.get(null)!,
    });
  }
  return groups;
}

export function BillsByYear({ bills }: { bills: BillRow[] }) {
  const groups = useMemo(() => groupByYear(bills), [bills]);
  // 기본: 가장 최근 연도(첫 그룹)만 펼침.
  const [openYears, setOpenYears] = useState<Set<number | null>>(
    () => new Set(groups.slice(0, 1).map((g) => g.yearKey)),
  );

  if (groups.length === 0) return null;

  function toggle(key: number | null) {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const open = openYears.has(g.yearKey);
        return (
          <div key={String(g.yearKey)} className="rounded-lg bg-zinc-900/60">
            <button
              type="button"
              onClick={() => toggle(g.yearKey)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="text-sm font-semibold text-zinc-100">
                {g.yearLabel}{" "}
                <span className="text-zinc-500">({g.bills.length}건)</span>
              </span>
              <span aria-hidden className="text-xs text-zinc-500">
                {open ? "▼" : "▶"}
              </span>
            </button>
            {open && (
              <ul className="space-y-2 px-2 pb-2">
                {g.bills.map((b) => (
                  <BillItem key={b.id} bill={b} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BillItem({ bill }: { bill: BillRow }) {
  const meta = BILL_STATUS_META[bill.billStatus];
  const proposed = bill.proposedAt
    ? bill.proposedAt instanceof Date
      ? bill.proposedAt
      : new Date(bill.proposedAt)
    : null;
  const dateLabel =
    proposed && !Number.isNaN(proposed.getTime())
      ? `${proposed.getFullYear()}년 ${proposed.getMonth() + 1}월 발의`
      : null;
  return (
    <li className="rounded-lg bg-zinc-950/60 p-3">
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-sm">
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-zinc-100">
            {bill.billName}
          </p>
          {bill.summary && (
            <p className="mt-1 text-xs text-zinc-400">🔍 쉽게 말하면: {bill.summary}</p>
          )}
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {meta.label}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </p>
          <a
            href={bill.billUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-xs font-medium text-zinc-300 hover:text-white"
          >
            → 국회에서 원문 보기
          </a>
        </div>
      </div>
    </li>
  );
}
