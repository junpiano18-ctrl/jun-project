"use client";

import Link from "next/link";
import { useState } from "react";
import { PoliticianPhoto } from "@/components/politician/PoliticianPhoto";
import { relativeTimeKo } from "@/lib/format/relative-time";
import type {
  OfficialActivity,
  OfficialWithActivity,
} from "@/lib/queries/region-feed";

const COLLAPSED = 3;
const EXPANDED = 10;

const VOTE_META: Record<
  "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT",
  { icon: string; label: string; tone: string }
> = {
  AGREE:    { icon: "✅", label: "찬성", tone: "text-emerald-600 dark:text-emerald-400" },
  DISAGREE: { icon: "❌", label: "반대", tone: "text-rose-600 dark:text-rose-400" },
  ABSTAIN:  { icon: "🟡", label: "기권", tone: "text-amber-600 dark:text-amber-400" },
  ABSENT:   { icon: "⚫", label: "불참", tone: "text-zinc-500" },
};

const BILL_STATUS_TAG: Record<"PENDING" | "PASSED" | "REJECTED", string> = {
  PENDING: "심사 중",
  PASSED: "통과",
  REJECTED: "처리 안 됨",
};

function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = d.getTime() - Date.now();
  if (ms < 0) return null;
  return Math.floor(ms / 86400000);
}

// 천원 단위 → "24.3억" / "4백만원"
function formatAsset(thousand: number | null): string | null {
  if (thousand === null) return null;
  const eok = thousand / 100_000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억`;
  return `${(thousand / 10_000).toFixed(0)}백만원`;
}

// "서울특별시 마포구을" → "마포구을"
function shortDistrict(name: string): string {
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

export function OfficialCard({ official }: { official: OfficialWithActivity }) {
  const [open, setOpen] = useState(false);
  const partyColor = official.party?.color ?? "#a1a1aa";
  const dDay = daysUntil(official.termEndDate);
  const asset = formatAsset(official.assetTotalKrw);
  const shown = official.activities.slice(0, open ? EXPANDED : COLLAPSED);
  const hasMore = official.activities.length > COLLAPSED;

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start gap-3">
        <PoliticianPhoto
          name={official.name}
          partyColor={partyColor}
          photoUrl={official.photoUrl}
          size={48}
          shape="circle"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-base font-semibold">
              {official.name}
            </span>
            {official.additionalRole && (
              <span
                className="rounded-full px-1.5 py-px text-[10px] font-semibold text-white"
                style={{ backgroundColor: "#CA8A04" }}
                title="현재 겸직"
              >
                +{official.additionalRole}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
            <span>{official.positionLabel}</span>
            {official.party && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: partyColor }}
                  />
                  {official.party.name}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{shortDistrict(official.districtName)}</span>
          </div>
        </div>
        {dDay !== null && (
          <span className="flex-none rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            임기 D-{dDay}
          </span>
        )}
      </header>

      {shown.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {shown.map((a) => (
            <ActivityRow key={a.id} activity={a} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-200 px-3 py-2.5 text-xs text-zinc-500 dark:border-zinc-700">
          최근 등록된 활동이 없어요.
        </p>
      )}

      {asset && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
          <span aria-hidden>💰</span>
          <span>
            재산{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {asset}
            </span>
            {official.assetYear && (
              <span className="ml-1 text-zinc-400">
                · {official.assetYear}년 신고
              </span>
            )}
          </span>
        </p>
      )}

      {official.pledgeCount > 0 && (
        <Link
          href={`/politicians/${official.routeId}#pledges`}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          <span aria-hidden>📋</span>
          <span>
            공약{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-100">
              {official.pledgeCount}개
            </span>{" "}
            등록됨
          </span>
        </Link>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <Link
          href={`/politicians/${official.routeId}`}
          className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          자세히 보기
        </Link>
        {hasMore && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {open ? "접기 ▲" : `펼쳐보기 ▼ (${official.activities.length})`}
          </button>
        )}
      </div>
    </article>
  );
}

function ActivityRow({ activity }: { activity: OfficialActivity }) {
  const when = relativeTimeKo(new Date(activity.at));

  if (activity.kind === "bill") {
    return (
      <li className="flex items-start gap-2">
        <span aria-hidden className="mt-0.5 text-sm">📋</span>
        <div className="min-w-0 flex-1">
          <a
            href={activity.billUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            {activity.billName}
          </a>
          {activity.summary && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">
              {activity.summary}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-zinc-400">
            발의 · {BILL_STATUS_TAG[activity.billStatus]} · {when}
          </p>
        </div>
      </li>
    );
  }

  const m = VOTE_META[activity.result];
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-0.5 text-sm">🗳️</span>
      <div className="min-w-0 flex-1">
        {activity.billUrl ? (
          <a
            href={activity.billUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            {activity.billName}
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {activity.billName}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-zinc-400">
          표결 ·{" "}
          <span className={`font-medium ${m.tone}`}>
            {m.icon} {m.label}
          </span>
          {" "}· {when}
        </p>
      </div>
    </li>
  );
}
