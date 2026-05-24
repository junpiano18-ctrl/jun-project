import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyTallyTable } from "@/components/bill/PartyTallyTable";
import { splitBillName } from "@/lib/format/bill-name";
import { getBillDetail } from "@/lib/queries/bills";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "처리일 미정";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default async function BillDetailPage({
  params,
}: PageProps<"/bills/[billId]">) {
  const { billId } = await params;
  const bill = await getBillDetail(billId);
  if (!bill) notFound();

  const { main, suffix } = splitBillName(bill.billName);
  const total = bill.voteTcnt;
  const yes = bill.yesTcnt;
  const no = bill.noTcnt;
  const blank = bill.blankTcnt;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;
  const noPct = total > 0 ? Math.round((no / total) * 100) : 0;
  const blankPct = total > 0 ? Math.round((blank / total) * 100) : 0;
  const passed = yes > no;

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/bills"
          className="mb-5 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← 법안 목록
        </Link>

        {/* 헤더 카드 */}
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div
            aria-hidden
            className="h-1"
            style={{ backgroundColor: passed ? "#10b981" : "#ef4444" }}
          />
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-bold leading-snug text-zinc-900 sm:text-xl">
                {main}
                {suffix && (
                  <span className="ml-1.5 text-xs font-normal text-zinc-500">
                    {suffix}
                  </span>
                )}
              </h1>
              {total > 0 ? (
                <span
                  className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    passed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {passed ? "통과" : "부결"}
                </span>
              ) : (
                <span className="flex-none rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600">
                  본회의 표결 전
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              {total > 0
                ? `본회의 처리일: ${fmtDate(bill.procDate)}`
                : bill.procDate
                ? `발의일: ${fmtDate(bill.procDate)}`
                : "발의일 미정"}
            </p>

            {bill.summary && (
              <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700">
                💬 {bill.summary}
              </p>
            )}
          </div>
        </section>

        <div className="mt-4 space-y-4">
          {/* 발의자 */}
          {bill.proposer && (
            <Card title="대표 발의">
              {bill.proposer.monaCd ? (
                <Link
                  href={`/politicians/${bill.proposer.monaCd}`}
                  className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3 transition hover:bg-zinc-100"
                >
                  <span
                    aria-hidden
                    className="h-3 w-3 flex-none rounded-full"
                    style={{ backgroundColor: bill.proposer.party?.color ?? "#888888" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-zinc-900">{bill.proposer.name}</div>
                    {bill.proposer.party && (
                      <div className="text-xs text-zinc-500">{bill.proposer.party.name}</div>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">상세 →</span>
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                  <span
                    aria-hidden
                    className="h-3 w-3 flex-none rounded-full"
                    style={{ backgroundColor: bill.proposer.party?.color ?? "#888888" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-zinc-900">{bill.proposer.name}</div>
                    {bill.proposer.party && (
                      <div className="text-xs text-zinc-500">{bill.proposer.party.name}</div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* 본회의 표결 결과 — 표결 거친 안건만 표시. 단순 발의는 가드. */}
          {total > 0 && (
          <Card title="본회의 표결 결과">
            <div className="text-base leading-relaxed text-zinc-700">
              재석{" "}
              <span className="text-2xl font-bold text-zinc-900 tabular-nums">{total}명</span>{" "}
              중{" "}
              <span className="text-emerald-700">
                <span className="text-xl font-bold tabular-nums">{yes}명</span> 찬성
              </span>
              ,{" "}
              <span className="text-red-700">
                <span className="text-xl font-bold tabular-nums">{no}명</span> 반대
              </span>
              {blank > 0 && (
                <>
                  ,{" "}
                  <span className="text-amber-700">
                    <span className="text-xl font-bold tabular-nums">{blank}명</span> 기권
                  </span>
                </>
              )}
              했어요
            </div>
            <div className="mt-4 overflow-hidden rounded-full bg-zinc-100">
              <div className="flex h-2.5 w-full">
                {yes > 0 && (
                  <div className="bg-emerald-500" style={{ width: `${yesPct}%` }} />
                )}
                {no > 0 && (
                  <div className="bg-red-500" style={{ width: `${noPct}%` }} />
                )}
                {blank > 0 && (
                  <div className="bg-amber-500" style={{ width: `${blankPct}%` }} />
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              <span className="text-emerald-700">찬성 {yesPct}%</span>
              <span className="text-zinc-300">·</span>
              <span className="text-red-700">반대 {noPct}%</span>
              {blank > 0 && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span className="text-amber-700">기권 {blankPct}%</span>
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-zinc-500">출처: 열린국회정보</p>
          </Card>
          )}

          {/* 정당별 찬반 */}
          {bill.partyTallies.length > 0 && (
            <Card title="정당별 찬반">
              <PartyTallyTable tallies={bill.partyTallies} />
              <p className="mt-3 text-xs text-zinc-500">
                22대 국회의원 표결 기준 · 출처: 열린국회정보
              </p>
            </Card>
          )}

          {/* 원문 링크 */}
          {bill.billUrl && (
            <Card title="원문 보기">
              <a
                href={bill.billUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100"
              >
                국회 의안정보시스템에서 열기 ↗
              </a>
            </Card>
          )}
        </div>

        <footer className="mt-8 space-y-1 text-center text-xs text-zinc-500">
          <p className="font-semibold text-zinc-700">
            판단은 유권자가, 데이터는 내머슴닷컴이
          </p>
          <p>출처: 열린국회정보 · 국회 의안정보시스템</p>
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
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}
