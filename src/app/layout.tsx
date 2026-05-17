import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { SearchBar } from "@/components/search/SearchBar";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "내머슴닷컴",
  description: "내가 뽑고, 내가 감시한다 — 국민이 고용한 4년 계약직 일꾼들",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="z-[1500] flex flex-col gap-3 border-b border-zinc-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight">내머슴닷컴</span>
            <span className="text-xs text-zinc-400">naemeosum.com</span>
          </Link>
          <SearchBar />
        </header>
        {children}
        <GlobalFooter />
      </body>
    </html>
  );
}
