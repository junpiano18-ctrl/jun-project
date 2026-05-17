"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// layout 안에서 클라이언트 사이드 라우팅에 따라 footer 표시 여부 결정.
// 정치인 상세 페이지(/politicians/*)는 다크 테마 자체 footer를 쓰므로 layout footer 숨김.
export function GlobalFooter() {
  const pathname = usePathname();
  const isPoliticianDetail = pathname?.startsWith("/politicians/");
  if (isPoliticianDetail) return null;
  return (
    <footer className="border-t border-zinc-200 px-6 py-5 text-xs leading-relaxed dark:border-zinc-800">
      <p className="mb-2 font-semibold text-zinc-700 dark:text-zinc-300">
        내가 뽑고, 내가 감시한다.
      </p>
      <p className="text-zinc-500 dark:text-zinc-400">
        의원 정보: 열린국회정보 (open.assembly.go.kr) | 선거 정보:
        중앙선거관리위원회 | 지도: © OpenStreetMap contributors | 재산:
        공직자윤리위원회
      </p>
      <p className="mt-1 text-zinc-400 dark:text-zinc-500">
        선거구 경계: © OhmyNews (MIT) · 행정동 경계: © VW-Lab 김승범
        (admdongkor)
      </p>
      <p className="mt-3 flex gap-3 text-zinc-500 dark:text-zinc-400">
        <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-200">
          개인정보처리방침
        </Link>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-700">·</span>
        <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-200">
          이용약관
        </Link>
      </p>
    </footer>
  );
}
