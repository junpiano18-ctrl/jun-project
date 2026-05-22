import Link from "next/link";
import { notFound } from "next/navigation";
import { BillsByYear } from "@/components/politician/BillsByYear";
import { CareerList } from "@/components/politician/CareerList";
import { PledgeCard } from "@/components/politician/PledgeCard";
import { PoliticianPhoto } from "@/components/politician/PoliticianPhoto";
import { NotableVotes } from "@/components/politician/NotableVotes";
import { VoteHistory } from "@/components/politician/VoteHistory";
import { WeeklySchedule } from "@/components/politician/WeeklySchedule";
import { HIDE_ATTENDANCE } from "@/lib/feature-flags";
import { getPoliticianByMonaCd } from "@/lib/queries/politician-detail";
import { getWeeklyScheduleFor } from "@/lib/sources/assembly-schedule";

export const dynamic = "force-dynamic";

// 연간 세비 — 국회사무처 공개 (2024년 기준)
const ANNUAL_SALARY = "약 1억 5,424만원";

type Committee = { name: string; start: string | null; end: string | null };

function daysUntil(date: Date): number {
  return Math.max(0, Math.floor((date.getTime() - Date.now()) / 86400000));
}

function formatAsset(thousand: bigint | number | null | undefined): string | null {
  if (thousand === null || thousand === undefined) return null;
  const n = Number(thousand);
  if (!isFinite(n)) return null;
  const eok = n / 100_000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억원`;
  return `${(n / 10_000).toFixed(0)}백만원`;
}

function formatChange(thousand: bigint | number | null | undefined): { text: string; icon: string } | null {
  if (thousand === null || thousand === undefined) return null;
  const n = Number(thousand);
  if (!isFinite(n)) return null;
  const eok = n / 100_000;
  if (Math.abs(eok) < 0.05) return { text: "작년과 비슷해요", icon: "" };
  return eok >= 0
    ? { text: `작년보다 ${eok.toFixed(1)}억원 늘었어요`, icon: "📈" }
    : { text: `작년보다 ${Math.abs(eok).toFixed(1)}억원 줄었어요`, icon: "📉" };
}

function dateLabel(iso: string | null): string {
  if (!iso) return "?";
  return iso.replace(/-/g, ".");
}

// "2025.07.21" 형식. DateTime을 한국식 점 구분 날짜로.
function formatKoreanDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export default async function PoliticianPage({
  params,
}: PageProps<"/politicians/[monaCd]">) {
  const { monaCd } = await params;
  const detail = await getPoliticianByMonaCd(monaCd);
  if (!detail) notFound();

  const { politician, currentTerm, recentVoteRecords, notableVoteRecords } = detail;
  const partyColor = currentTerm?.party?.color ?? "#888888";
  const partyName = currentTerm?.party?.name ?? "무소속";
  const latestAsset = politician.assets[0] ?? null;
  const bills = politician.bills ?? [];
  const age =
    politician.birthYear !== null
      ? new Date().getFullYear() - politician.birthYear
      : null;
  // HTML entity decode + 글머리 정리 + 줄 split.
  const careerLines: string[] = (politician.careerText ?? "")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .split(/\r?\n/)
    .map((s) => s.replace(/^[·•\s]+/, "").trim())
    .filter(Boolean);

  // null/undefined 안전 처리
  const attendanceRate = currentTerm?.attendanceRate ?? null;
  const voteAttend = currentTerm?.plenaryVoteAttendCount ?? null;
  const voteSession = currentTerm?.plenaryVoteSessionCount ?? null;
  const billProposed = currentTerm?.billProposedCount ?? null;
  const billPassed = currentTerm?.billPassedCount ?? null;

  // 위원회 JSON 파싱
  const rawCommittees = currentTerm?.committees;
  const committees: Committee[] = Array.isArray(rawCommittees)
    ? (rawCommittees as unknown as Committee[]).filter(
        (c) => c && typeof c === "object" && typeof c.name === "string",
      )
    : [];

  const termEnd = currentTerm?.term.endDate ?? null;
  const dDay = termEnd ? daysUntil(termEnd) : null;

  const pledges = currentTerm?.pledges ?? [];
  const voteRecords = recentVoteRecords ?? [];
  const notableVotes = notableVoteRecords ?? [];

  // 이번 주 일정 — 현 위원회(end=null) 매칭. 22대 NA term에만 의미.
  const activeCommitteeNames = committees.filter((c) => !c.end).map((c) => c.name);
  const isCurrent22Assembly =
    currentTerm?.term.positionType === "NATIONAL_ASSEMBLY" &&
    currentTerm?.term.number === 22 &&
    currentTerm?.status === "ACTIVE";
  const weeklySchedule = isCurrent22Assembly
    ? await getWeeklyScheduleFor(activeCommitteeNames).catch(() => null)
    : null;

  const assetTotal = latestAsset ? formatAsset(latestAsset.totalKrw) : null;
  const assetChange = latestAsset ? formatChange(latestAsset.changeKrw) : null;

  // 표시 조건. 출석률은 데이터 신뢰도 문제로 일시 숨김 (HIDE_ATTENDANCE).
  const showAttendance =
    !HIDE_ATTENDANCE &&
    attendanceRate !== null &&
    voteAttend !== null &&
    voteSession !== null;
  const showBills = billProposed !== null;
  const showCommittees = committees.length > 0;
  const showAssets = latestAsset !== null && assetTotal !== null;
  const showPledges = pledges.length > 0;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/map"
          className="mb-5 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-200"
        >
          ← 지도로 돌아가기
        </Link>

        {/* 헤더 카드 */}
        <section
          className="overflow-hidden rounded-xl"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          <div aria-hidden className="h-1" style={{ backgroundColor: partyColor }} />
          <div className="p-5 sm:p-6">
            {currentTerm && currentTerm.status !== "ACTIVE" && (
              <span className="mb-3 inline-block rounded-full bg-red-600/85 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">
                {currentTerm.status === "DISMISSED" && "의원직 상실"}
                {currentTerm.status === "SUSPENDED" && "직무정지"}
                {currentTerm.status === "DECEASED" && "사망"}
              </span>
            )}
            <div className="flex items-start gap-4 sm:gap-5">
              <PoliticianPhoto
                name={politician.name}
                partyColor={partyColor}
                photoUrl={politician.photoUrl}
                size={88}
                showCredit
                shape="circle"
              />
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    {politician.name}
                  </h1>
                  {politician.hanjaName && (
                    <span className="text-sm text-zinc-500">
                      ({politician.hanjaName})
                    </span>
                  )}
                  {currentTerm?.additionalRole && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: "#CA8A04" }}
                      title="현재 겸직"
                    >
                      + {currentTerm.additionalRole}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: partyColor }}
                  >
                    {partyName}
                  </span>
                  {currentTerm && (
                    <span className="text-xs text-zinc-400">
                      {currentTerm.positionTitle} · {currentTerm.district.name}
                      {currentTerm.electedAs === "PROPORTIONAL" && " · 비례대표"}
                    </span>
                  )}
                </div>
                {politician.birthYear !== null && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {politician.birthYear}년생{age !== null ? ` (만 ${age}세)` : ""}
                  </p>
                )}
                {currentTerm?.additionalRole && (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                    현재 겸직:{" "}
                    <span className="font-semibold text-white">
                      {currentTerm.additionalRole}
                    </span>
                    {currentTerm.additionalRoleStartDate && (
                      <>
                        {" "}
                        ({formatKoreanDate(currentTerm.additionalRoleStartDate)}~)
                      </>
                    )}
                    {currentTerm.additionalRoleSource && (
                      <span className="mt-0.5 block text-zinc-500">
                        출처: {currentTerm.additionalRoleSource}
                      </span>
                    )}
                  </p>
                )}
                {currentTerm?.courtRulingSummary && (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                    법원 판결:{" "}
                    {currentTerm.courtRulingDate && (
                      <span className="text-white">
                        {formatKoreanDate(currentTerm.courtRulingDate)}{" "}
                      </span>
                    )}
                    <span className="font-semibold text-white">
                      {currentTerm.courtRulingSummary}
                    </span>
                    {currentTerm.courtRulingFinal && (
                      <span className="ml-1.5 inline-block rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200">
                        확정
                      </span>
                    )}
                    {currentTerm.courtRulingSource && (
                      <span className="mt-0.5 block text-zinc-500">
                        출처: {currentTerm.courtRulingSource}
                      </span>
                    )}
                  </p>
                )}
                {dDay !== null && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-100">
                    ⏳ 아직 {dDay}일 더 일해야 해요 💪
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4 space-y-4">
          {weeklySchedule && (
            <WeeklySchedule data={weeklySchedule} partyColor={partyColor} />
          )}

          {showAttendance && (
            <Card title="전체 회의 출석">
              <p className="text-base leading-relaxed text-zinc-200">
                전체 회의{" "}
                <span className="text-xl font-bold text-white">
                  {voteSession}번
                </span>{" "}
                중{" "}
                <span className="text-xl font-bold text-white">
                  {voteAttend}번
                </span>{" "}
                표결에 참여했어요
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(attendanceRate as number) * 100}%`,
                    backgroundColor: partyColor,
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                표결 참여 기준 · 출처: 열린국회정보
              </p>
            </Card>
          )}

          {showBills && (
            <Card title="직접 낸 법안">
              <p className="text-base leading-relaxed text-zinc-200">
                이번 임기에 법안{" "}
                <span className="text-2xl font-bold text-white">
                  {billProposed}개
                </span>
                를 냈어요
                {billPassed !== null &&
                  (billPassed === 0 ? (
                    <span className="block mt-1 text-sm text-zinc-400">
                      아직 통과된 법안이 없어요
                    </span>
                  ) : (
                    <span className="block mt-1 text-sm text-zinc-300">
                      그중{" "}
                      <span className="font-bold text-white">{billPassed}개</span>
                      가 통과됐어요 ✅
                    </span>
                  ))}
              </p>
              <p className="mt-3 text-xs text-zinc-500">
                22대 임기 직접 낸 법안 · 출처: 열린국회정보
              </p>
            </Card>
          )}

          {bills.length > 0 && (
            <Card title="법안 목록">
              <BillsByYear bills={bills} />
              <p className="mt-3 text-xs text-zinc-500">
                출처: 열린국회정보 · 국회 의안정보시스템
              </p>
            </Card>
          )}

          {notableVotes.length > 0 && (
            <Card title="📌 주목할 표결">
              <NotableVotes votes={notableVotes} />
              <p className="mt-3 text-xs text-zinc-500">
                찬반이 극명하게 갈린 표결({notableVotes.length}건) · 출처: 열린국회정보
              </p>
            </Card>
          )}

          {voteRecords.length > 0 && (
            <Card title="주요 표결 이력">
              <VoteHistory votes={voteRecords} />
              <p className="mt-3 text-xs text-zinc-500">
                최근 표결 {voteRecords.length}건 · 판단/평가 없이 팩트만 · 출처: 열린국회정보
              </p>
            </Card>
          )}

          {showCommittees && (
            <Card title="위원회 활동">
              <ul className="space-y-2">
                {committees.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg bg-zinc-900/60 px-3 py-2.5"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 flex-none rounded-full"
                      style={{ backgroundColor: !c.end ? partyColor : "#52525b" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {c.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {dateLabel(c.start)} ~ {c.end ? dateLabel(c.end) : "현재"}
                      </div>
                    </div>
                    {!c.end && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: partyColor }}
                      >
                        현재
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-500">
                출처: 열린국회정보
              </p>
            </Card>
          )}

          {showAssets && latestAsset && (
            <Card title="신고 재산">
              <div className="text-3xl font-bold tabular-nums text-white">
                {assetTotal}
              </div>
              {assetChange && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-300">
                  {assetChange.icon && <span>{assetChange.icon}</span>}
                  <span>{assetChange.text}</span>
                </p>
              )}
              <p className="mt-3 text-xs text-zinc-500">
                {latestAsset.year}년 신고 · 출처: {latestAsset.source}
              </p>
            </Card>
          )}

          {careerLines.length > 0 && (
            <Card title="학력 · 경력">
              <CareerList lines={careerLines} />
              <p className="mt-3 text-xs text-zinc-500">출처: 열린국회정보</p>
            </Card>
          )}

          {/* 연간 세비 — 항상 표시 (고정값) */}
          <Card title="연간 월급 (세금으로 지급)">
            <div className="text-xl font-bold text-white">{ANNUAL_SALARY}</div>
            <p className="mt-3 text-xs text-zinc-500">
              출처: 국회사무처 공개 자료
            </p>
          </Card>

          {showPledges && (
            <Card title="선거 공약">
              <ul className="space-y-3">
                {pledges.map((p) => (
                  <PledgeCard
                    key={p.id}
                    pledge={{
                      id: p.id,
                      category: p.category,
                      title: p.title,
                      originalText: p.originalText,
                      easySummary: p.easySummary,
                      status: p.status,
                    }}
                  />
                ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-500">
                출처: 중앙선거관리위원회
              </p>
            </Card>
          )}
        </div>

        <footer className="mt-8 space-y-1 text-center text-xs text-zinc-500">
          <p className="font-semibold text-zinc-300">
            판단은 유권자가, 데이터는 내머슴닷컴이
          </p>
          <p>출처: 열린국회정보 · 중앙선거관리위원회 · 공직자윤리위원회</p>
          <p className="flex items-center justify-center gap-3 pt-2">
            <Link href="/privacy" className="hover:text-zinc-300">
              개인정보처리방침
            </Link>
            <span aria-hidden className="text-zinc-700">·</span>
            <Link href="/terms" className="hover:text-zinc-300">
              이용약관
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl p-5" style={{ backgroundColor: "#1a1a1a" }}>
      <h2 className="mb-3 text-sm font-semibold text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

