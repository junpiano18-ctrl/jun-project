import Link from "next/link";
import type { HomeFeed, RecentAsset, RecentBill, RecentVote } from "@/lib/queries/home-feed";
import type { TodaySchedule } from "@/lib/sources/assembly-schedule";
import { splitBillName } from "@/lib/format/bill-name";

// "오늘의 국회 📰" — 2x2 그리드. 각 카드 1건 미리보기 + "더보기 →".
// 모든 카드 동일 높이 (grid-cols-2 + grid auto-rows-fr).

type Props = {
  feed: HomeFeed;
  schedule: TodaySchedule;
};

export function TodayFeed({ feed, schedule }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 auto-rows-fr sm:gap-4">
      <VoteCard item={feed.recentVotes[0]} />
      <BillCard item={feed.recentBills[0]} />
      <AssetCard item={feed.recentAssets[0]} />
      <ScheduleCard schedule={schedule} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 공통 카드 — 동일 높이·구조 (header / body 1줄 / footer "더보기")
// ────────────────────────────────────────────────────────────
function Card({
  emoji,
  title,
  moreHref,
  children,
}: {
  emoji: string;
  title: string;
  moreHref: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={moreHref}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      {/* 상단 포인트 바 — 4개 카드 통일 바이올렛 */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-[#7C3AED]"
      />
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-2xl leading-none">
          {emoji}
        </span>
        <span className="text-sm font-bold tracking-tight text-zinc-900">
          {title}
        </span>
      </div>
      <div className="flex-1 text-zinc-700">{children}</div>
      <div className="mt-4 text-xs font-semibold text-[#7C3AED] group-hover:text-[#5B21B6]">
        더보기 →
      </div>
    </Link>
  );
}

function EmptyBody({ text }: { text: string }) {
  return (
    <p className="text-xs leading-relaxed text-zinc-400">{text}</p>
  );
}

// ────────────────────────────────────────────────────────────
// 표결 카드
// ────────────────────────────────────────────────────────────
function VoteCard({ item }: { item?: RecentVote }) {
  return (
    <Card emoji="🗳️" title="최근 본회의 표결" moreHref="/bills">
      {item ? (
        <>
          <p className="line-clamp-1 text-[13px] font-semibold leading-snug text-zinc-900">
            {splitBillName(item.billName).main}
          </p>
          {item.summary && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
              💬 {item.summary}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] tabular-nums">
            <span className="text-emerald-700">✅ {item.yesTcnt}</span>
            <span className="text-rose-700">❌ {item.noTcnt}</span>
            {item.blankTcnt > 0 && (
              <span className="text-amber-700">🟡 {item.blankTcnt}</span>
            )}
          </div>
        </>
      ) : (
        <EmptyBody text="최근 본회의 표결 데이터가 없어요." />
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// 발의 법안 카드
// ────────────────────────────────────────────────────────────
function BillCard({ item }: { item?: RecentBill }) {
  return (
    <Card emoji="📋" title="최근 발의된 법안" moreHref="/bills">
      {item ? (
        <>
          <p className="line-clamp-1 text-[13px] font-semibold leading-snug text-zinc-900">
            {splitBillName(item.billName).main}
          </p>
          {item.summary && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
              💬 {item.summary}
            </p>
          )}
          {item.proposer && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-600">
              {item.proposer.partyColor && (
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 flex-none rounded-full"
                  style={{ backgroundColor: item.proposer.partyColor }}
                />
              )}
              <span className="font-medium text-zinc-700">{item.proposer.name}</span>
              {item.proposer.partyName && (
                <span className="truncate text-zinc-400">· {item.proposer.partyName}</span>
              )}
            </div>
          )}
        </>
      ) : (
        <EmptyBody text="최근 발의 법안 데이터가 없어요." />
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// 재산 공개 카드
// ────────────────────────────────────────────────────────────
function formatEok(thousand: bigint | number): string {
  const n = typeof thousand === "bigint" ? Number(thousand) : thousand;
  if (!isFinite(n)) return "?";
  const eok = n / 100_000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억`;
  return `${(n / 10_000).toFixed(0)}백만원`;
}

function formatChange(thousand: bigint | null): { text: string; tone: string } | null {
  if (thousand === null) return null;
  const n = Number(thousand);
  if (!isFinite(n)) return null;
  const eok = n / 100_000;
  if (Math.abs(eok) < 0.05) return { text: "작년比 비슷", tone: "text-zinc-500" };
  return eok >= 0
    ? { text: `작년比 +${eok.toFixed(1)}억`, tone: "text-emerald-700" }
    : { text: `작년比 ${eok.toFixed(1)}억`, tone: "text-rose-700" };
}

function AssetCard({ item }: { item?: RecentAsset }) {
  return (
    <Card emoji="💰" title="최근 재산 공개" moreHref="/map">
      {item ? (
        <>
          <div className="flex items-baseline gap-1.5">
            {item.partyColor && (
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 flex-none rounded-full"
                style={{ backgroundColor: item.partyColor }}
              />
            )}
            <span className="truncate text-[13px] font-semibold text-zinc-900">
              {item.name}
            </span>
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-zinc-900">
            {formatEok(item.totalKrw)}
          </div>
          {(() => {
            const change = formatChange(item.changeKrw);
            return change ? (
              <div className={`text-[11px] tabular-nums ${change.tone}`}>{change.text}</div>
            ) : null;
          })()}
        </>
      ) : (
        <EmptyBody text="최근 재산 공개 데이터가 없어요." />
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// 오늘 일정 카드 — 외부 링크 가능하지만 우선 detail 없으므로 /map 추천 안 맞아 본회의 라이브 페이지 미정.
// 클릭 동작은 일단 ATTACH 안 함 — Card가 Link라 moreHref="#" 같은 곳으로. 임시로 /bills로 보냄 (관련 정보).
// TODO: 의사일정 전용 페이지가 생기면 그쪽으로.
// ────────────────────────────────────────────────────────────
function ScheduleCard({ schedule }: { schedule: TodaySchedule }) {
  // 본회의가 있으면 우선 표시, 없으면 첫 위원회.
  const plenary = schedule.plenary[0];
  const committee = schedule.committee[0];
  const top = plenary ?? committee;
  const total = schedule.plenary.length + schedule.committee.length;

  return (
    <Card emoji="📅" title="오늘 국회 일정" moreHref="/map">
      {top ? (
        <>
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-900">
            {plenary
              ? `본회의 · ${plenary.title}`
              : `${committee!.committeeName ?? "위원회"} · ${committee!.title}`}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] tabular-nums text-zinc-600">
            {top.time && <span className="font-medium text-zinc-700">{top.time}</span>}
            {total > 1 && (
              <span className="text-zinc-500">외 {total - 1}건</span>
            )}
          </div>
        </>
      ) : (
        <EmptyBody text="오늘 예정된 일정 없음" />
      )}
    </Card>
  );
}
