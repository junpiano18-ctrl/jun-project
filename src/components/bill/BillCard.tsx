import Link from "next/link";
import { splitBillName } from "@/lib/format/bill-name";
import type { BillListItem } from "@/lib/queries/bills";

function fmtDate(d: Date | null): string {
  if (!d) return "처리일 미정";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function BillCard({ bill }: { bill: BillListItem }) {
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
    <Link
      href={`/bills/${bill.billId}`}
      className="block rounded-xl bg-[#1a1a1a] p-4 transition hover:bg-[#222]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-zinc-100">
          {main}
          {suffix && (
            <span className="ml-1.5 text-[11px] font-normal text-zinc-500">
              {suffix}
            </span>
          )}
        </h3>
        <span
          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${
            passed
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-red-500/20 text-red-300"
          }`}
        >
          {passed ? "통과" : "부결"}
        </span>
      </div>

      {bill.summary && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">
          💬 {bill.summary}
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-full bg-zinc-800/60">
        <div className="flex h-1.5 w-full">
          {yes > 0 && (
            <div className="bg-emerald-500/80" style={{ width: `${yesPct}%` }} />
          )}
          {no > 0 && (
            <div className="bg-red-500/80" style={{ width: `${noPct}%` }} />
          )}
          {blank > 0 && (
            <div className="bg-amber-500/70" style={{ width: `${blankPct}%` }} />
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
        <span className="text-emerald-300">
          찬성 {yes}명 ({yesPct}%)
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-red-300">
          반대 {no}명 ({noPct}%)
        </span>
        {blank > 0 && (
          <>
            <span className="text-zinc-600">·</span>
            <span className="text-amber-300">기권 {blank}명</span>
          </>
        )}
        <span className="ml-auto text-zinc-500">{fmtDate(bill.procDate)}</span>
      </div>
    </Link>
  );
}
