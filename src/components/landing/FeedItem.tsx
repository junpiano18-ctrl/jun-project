import Link from "next/link";
import { relativeTimeKo } from "@/lib/format/relative-time";
import type { FeedItem as FeedItemType } from "@/lib/queries/region-feed";

const POSITION_ICON: Record<string, string> = {
  NATIONAL_ASSEMBLY: "🏛️",
  METRO_GOVERNOR: "🏙️",
  EDUCATION_SUPERINTENDENT: "🎓",
  LOCAL_GOVERNOR: "🏢",
};

const VOTE_META: Record<
  "AGREE" | "DISAGREE" | "ABSTAIN" | "ABSENT",
  { icon: string; label: string }
> = {
  AGREE:    { icon: "✅", label: "찬성했어요" },
  DISAGREE: { icon: "❌", label: "반대했어요" },
  ABSTAIN:  { icon: "🟡", label: "기권했어요" },
  ABSENT:   { icon: "⚫", label: "불참했어요" },
};

const BILL_STATUS_TAG: Record<"PENDING" | "PASSED" | "REJECTED", string> = {
  PENDING: "심사 중",
  PASSED: "통과",
  REJECTED: "처리 안 됨",
};

export function FeedItem({ item }: { item: FeedItemType }) {
  const o = item.official;
  const partyColor = o.party?.color ?? "#a1a1aa";
  const icon = POSITION_ICON[o.position] ?? "🏛️";
  const districtShort = shortDistrict(o.districtName);
  const when = relativeTimeKo(item.at);

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* 헤더: 의원 정보 */}
      <header className="flex items-start gap-2">
        <span aria-hidden className="mt-0.5 text-base">{icon}</span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/politicians/${o.routeId}`}
            className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
          >
            {o.name}
          </Link>
          <span className="ml-1.5 text-xs text-zinc-500">
            · {o.positionLabel}
            {districtShort ? ` · ${districtShort}` : ""}
          </span>
          <p className="mt-0.5 text-[11px] text-zinc-400">{when}</p>
        </div>
        {o.party && (
          <span
            aria-label={o.party.name}
            className="h-2 w-2 flex-none translate-y-1 rounded-full"
            style={{ backgroundColor: partyColor }}
          />
        )}
      </header>

      {/* 본문 */}
      {item.kind === "bill" ? (
        <BillBody item={item} />
      ) : (
        <VoteBody item={item} />
      )}
    </article>
  );
}

function BillBody({
  item,
}: {
  item: Extract<FeedItemType, { kind: "bill" }>;
}) {
  return (
    <div className="mt-3 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
      <p className="text-xs font-medium text-zinc-500">📋 법안 발의</p>
      <a
        href={item.billUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-sm font-semibold leading-snug text-zinc-900 hover:underline dark:text-zinc-100"
      >
        &quot;{item.billName}&quot;
      </a>
      {item.summary && (
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          💬 {item.summary}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {BILL_STATUS_TAG[item.billStatus]}
        </span>
        <a
          href={item.billUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          → 자세히 보기
        </a>
      </div>
    </div>
  );
}

function VoteBody({
  item,
}: {
  item: Extract<FeedItemType, { kind: "vote" }>;
}) {
  const m = VOTE_META[item.result];
  return (
    <div className="mt-3 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
      <p className="text-xs font-medium text-zinc-500">🗳️ 표결 참여</p>
      {item.billUrl ? (
        <a
          href={item.billUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-sm font-semibold leading-snug text-zinc-900 hover:underline dark:text-zinc-100"
        >
          &quot;{item.billName}&quot;
        </a>
      ) : (
        <p className="mt-1 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
          &quot;{item.billName}&quot;
        </p>
      )}
      <p className="mt-1.5 text-sm">
        <span aria-hidden className="mr-1">{m.icon}</span>
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {m.label}
        </span>
      </p>
    </div>
  );
}

// "서울특별시 마포구" → "마포구", "서울 마포구을" → "마포구을"
function shortDistrict(name: string): string {
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] ?? name;
}
