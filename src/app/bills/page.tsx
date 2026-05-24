import Link from "next/link";
import { BillCard } from "@/components/bill/BillCard";
import { BillFilters } from "@/components/bill/BillFilters";
import { listBills, type BillFilter } from "@/lib/queries/bills";

export const dynamic = "force-dynamic";

function parseFilter(v: string | undefined): BillFilter {
  if (v === "passed" || v === "rejected") return v;
  return "all";
}

export default async function BillsPage({
  searchParams,
}: PageProps<"/bills">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const filter = parseFilter(typeof sp.filter === "string" ? sp.filter : undefined);
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const { bills, total, pageSize } = await listBills({ q, filter, page });
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/"
          className="mb-5 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← 홈으로
        </Link>

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">본회의 처리 법안</h1>
          <p className="mt-1 text-sm text-zinc-500">
            22대 국회 본회의에서 표결한 법안 {total.toLocaleString()}건
          </p>
        </header>

        <div className="mb-6">
          <BillFilters initialQ={q} initialFilter={filter} />
        </div>

        {bills.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-zinc-500">
              {q
                ? `"${q}"에 해당하는 법안이 없어요.`
                : "표시할 법안이 없어요."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {bills.map((b) => (
              <li key={b.billId}>
                <BillCard bill={b} />
              </li>
            ))}
          </ul>
        )}

        {bills.length > 0 && lastPage > 1 && (
          <Pagination page={page} lastPage={lastPage} q={q} filter={filter} />
        )}

        <footer className="mt-10 space-y-1 text-center text-xs text-zinc-500">
          <p className="font-semibold text-zinc-700">
            판단은 유권자가, 데이터는 내머슴닷컴이
          </p>
          <p>출처: 열린국회정보 · 국회 의안정보시스템</p>
        </footer>
      </div>
    </div>
  );
}

function Pagination({
  page,
  lastPage,
  q,
  filter,
}: {
  page: number;
  lastPage: number;
  q: string;
  filter: BillFilter;
}) {
  function href(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "all") params.set("filter", filter);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/bills${s ? `?${s}` : ""}`;
  }
  const prev = page > 1 ? href(page - 1) : null;
  const next = page < lastPage ? href(page + 1) : null;

  return (
    <nav className="mt-6 flex items-center justify-between text-sm">
      {prev ? (
        <Link
          href={prev}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
        >
          ← 이전
        </Link>
      ) : (
        <span className="rounded-md border border-zinc-100 px-3 py-1.5 text-zinc-400">
          ← 이전
        </span>
      )}
      <span className="text-xs text-zinc-500">
        {page} / {lastPage}
      </span>
      {next ? (
        <Link
          href={next}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
        >
          다음 →
        </Link>
      ) : (
        <span className="rounded-md border border-zinc-100 px-3 py-1.5 text-zinc-400">
          다음 →
        </span>
      )}
    </nav>
  );
}
