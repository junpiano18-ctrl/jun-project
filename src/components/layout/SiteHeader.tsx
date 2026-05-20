"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";

export function SiteHeader() {
  const pathname = usePathname();
  // 랜딩 페이지는 자체 히어로/검색을 가지므로 글로벌 헤더 숨김.
  if (pathname === "/") return null;

  return (
    <header className="z-[1500] flex flex-col gap-3 border-b border-zinc-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
      <Link href="/" className="flex items-baseline gap-2">
        <span className="text-base font-bold tracking-tight">내머슴닷컴</span>
        <span className="text-xs text-zinc-400">naemeosum.com</span>
      </Link>
      <SearchBar />
    </header>
  );
}
