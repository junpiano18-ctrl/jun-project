"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { splitBillName } from "@/lib/format/bill-name";

// 법안 표결 결과 공유 버튼 4종 + 이미지 카드 생성(인스타용).
// 모바일 44x44 hit area. 법안 상세 페이지에 임베드.

type Props = {
  billId: string;
  billName: string;
  voteTcnt: number;
  yesTcnt: number;
  noTcnt: number;
  blankTcnt: number;
};

const SITE = "naemeosum.com";

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

export function BillShareButtons({
  billId,
  billName,
  voteTcnt,
  yesTcnt,
  noTcnt,
  blankTcnt,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { main } = splitBillName(billName);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/bills/${billId}`
      : `https://${SITE}/bills/${billId}`;
  const shareText = `[내머슴닷컴] ${main} — 본회의 표결 결과`;

  const yesPct = pct(yesTcnt, voteTcnt);
  const noPct = pct(noTcnt, voteTcnt);
  const blankPct = pct(blankTcnt, voteTcnt);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  // ── 1. 카카오톡 — 시스템 공유 시트(navigator.share)로 카카오톡 선택 유도. ──
  //   Kakao JavaScript SDK는 별도 키 발급·도메인 등록 필요해서 일단 OS 공유 시트로 통일.
  //   데스크톱에서 share 미지원이면 링크 복사로 fallback.
  async function shareKakao() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url: shareUrl });
      } catch (e) {
        // 사용자가 취소한 AbortError는 무시
        if ((e as Error).name !== "AbortError") {
          await copyLink("공유 시트가 닫혀 링크를 복사했어요");
        }
      }
    } else {
      await copyLink("카카오톡 공유는 모바일에서 가능해요. 링크를 복사했어요");
    }
  }

  // ── 2. 트위터/X — URL intent로 새 창 열기. ──
  function shareTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ── 3. 인스타그램 — 이미지 카드 PNG 다운로드 + 안내. ──
  //   인스타는 직접 공유 URL 없음. 사용자가 다운로드 → 인스타 스토리에서 직접 업로드.
  async function shareInstagram() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2, // 고해상도 (인스타 권장 1080x1080 이상)
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `naemeosum-vote-${billId}.png`;
      a.click();
      showToast("이미지를 저장했어요. 인스타 스토리에 올려보세요 📷");
    } catch (e) {
      console.error(e);
      showToast("이미지 생성 실패 — 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  }

  // ── 4. 링크 복사. ──
  async function copyLink(successMsg = "링크가 복사됐어요 📋") {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(successMsg);
    } catch {
      showToast("복사 실패 — 주소창에서 직접 복사해 주세요");
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <ShareButton
          label="카카오톡으로 공유"
          onClick={shareKakao}
          bgColor="#FEE500"
          textColor="#3C1E1E"
          icon={<KakaoIcon />}
        />
        <ShareButton
          label="X(트위터)에 공유"
          onClick={shareTwitter}
          bgColor="#000000"
          textColor="#FFFFFF"
          icon={<XIcon />}
        />
        <ShareButton
          label="인스타그램 이미지 저장"
          onClick={shareInstagram}
          gradient="linear-gradient(135deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)"
          textColor="#FFFFFF"
          icon={busy ? <Spinner /> : <InstagramIcon />}
          disabled={busy}
        />
        <ShareButton
          label="링크 복사"
          onClick={() => copyLink()}
          bgColor="#7C3AED"
          textColor="#FFFFFF"
          icon={<LinkIcon />}
        />
      </div>

      {/* toast 알림 */}
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900/95 px-3 py-1.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 인스타용 카드 — 화면 밖에 렌더. html-to-image로 캡처. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -9999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <div
          ref={cardRef}
          style={{
            width: 540,
            height: 540,
            background: "linear-gradient(135deg, #F8F5FF 0%, #EDE9FE 100%)",
            padding: 48,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', sans-serif",
            color: "#1A1A1A",
            boxSizing: "border-box",
          }}
        >
          {/* 상단 로고 */}
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
              내머슴<span style={{ color: "#7C3AED" }}>닷컴</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: "#71717A" }}>
              내가 뽑고, 내가 감시한다
            </div>
          </div>

          {/* 본문 — 법안명 + 표결 비율 */}
          <div>
            <div style={{ marginBottom: 14, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#7C3AED" }}>
              본회의 표결 결과
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1.3,
                color: "#1A1A1A",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {main}
            </div>

            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <VoteRow label="찬성" value={yesTcnt} pct={yesPct} color="#10B981" />
              <VoteRow label="반대" value={noTcnt} pct={noPct} color="#EF4444" />
              {blankTcnt > 0 && (
                <VoteRow label="기권" value={blankTcnt} pct={blankPct} color="#F59E0B" />
              )}
            </div>

            <div style={{ marginTop: 18, fontSize: 13, color: "#71717A" }}>
              재석 {voteTcnt}명 · 출처 열린국회정보
            </div>
          </div>

          {/* 하단 도메인 */}
          <div style={{ fontSize: 14, fontWeight: 600, color: "#7C3AED", textAlign: "right" }}>
            {SITE}
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#3F3F46" }}>{label}</span>
        <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {value}명 <span style={{ color: "#71717A", fontSize: 14, fontWeight: 500 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 8, background: "#E4E4E7", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ───── 버튼 공통 ─────
type ShareButtonProps = {
  label: string;
  onClick: () => void;
  bgColor?: string;
  gradient?: string;
  textColor: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

function ShareButton({ label, onClick, bgColor, gradient, textColor, icon, disabled }: ShareButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-full shadow-sm transition active:scale-[0.95] disabled:opacity-60"
      style={{
        background: gradient ?? bgColor,
        color: textColor,
      }}
    >
      {icon}
    </button>
  );
}

// ───── 아이콘 ─────
function KakaoIcon() {
  // 카카오톡 말풍선 (단순화). 실제 BI는 별도 라이선스 필요해서 generic 말풍선으로 대체.
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M12 3C6.48 3 2 6.58 2 11c0 2.78 1.78 5.22 4.47 6.63L5.4 21l3.9-2.55c.87.13 1.78.2 2.7.2 5.52 0 10-3.58 10-8s-4.48-7.65-10-7.65z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 6" />
      <path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07L13 18" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}
