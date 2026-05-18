import Link from "next/link";
import { PoliticianPhoto } from "@/components/politician/PoliticianPhoto";
import type { PoliticianPin } from "@/lib/queries/politician-pins";

const STATUS_LABEL: Record<string, string> = {
  DISMISSED: "의원직 상실",
  SUSPENDED: "직무정지",
  DECEASED: "사망",
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 86400000));
}

function formatAsset(thousand: number | null | undefined): string | null {
  if (thousand === null || thousand === undefined) return null;
  const eok = thousand / 100_000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(1)}억원`;
  return `${(thousand / 10_000).toFixed(0)}백만원`;
}

// 직급별 지역구 라벨. 데이터 비어있으면 빈 문자열.
//   국회의원   → "서울 마포구을" (그대로)
//   광역단체장 → "서울특별시" (그대로)
//   교육감     → "서울특별시 교육감"
//   기초단체장 → "마포구" (시도명 제거)
function districtLabel(pin: PoliticianPin): string {
  const name = (pin.districtName ?? "").trim();
  if (!name) return "";
  switch (pin.layer) {
    case "edu":
      return `${name} 교육감`;
    case "localGov": {
      // 마지막 토큰만 (예: "서울특별시 종로구" → "종로구")
      const parts = name.split(/\s+/);
      return parts[parts.length - 1] ?? name;
    }
    case "metroGov":
    case "national":
    default:
      return name;
  }
}

// 지도 popup 카드. 데이터 없는 줄은 아예 렌더 안 함.
export function PoliticianCard({ pin }: { pin: PoliticianPin }) {
  const color = pin.party?.color ?? "#888888";
  const vacant = Boolean(pin.status) && pin.status !== "ACTIVE";
  const district = districtLabel(pin);

  // 출석률 = attend/session 비율을 % 표현. 본회의 데이터 모두 있어야 표시.
  const attendDisplay =
    pin.attendanceAttend !== null &&
    pin.attendanceAttend !== undefined &&
    pin.attendanceSession !== null &&
    pin.attendanceSession !== undefined &&
    pin.attendanceSession > 0
      ? `${((pin.attendanceAttend / pin.attendanceSession) * 100).toFixed(1)}%`
      : null;
  const asset = formatAsset(pin.assetTotalKrw);
  const dDay = daysUntil(pin.termEndDate);
  const dDayDisplay = dDay !== null ? `D-${dDay}` : null;

  // 사용자 요청 순서: D-day(항상) → 본회의 출석률 → 재산.
  const facts: Array<{ icon: string; label: string; value: string }> = [];
  if (dDayDisplay) facts.push({ icon: "⏳", label: "남은 임기", value: dDayDisplay });
  if (attendDisplay) facts.push({ icon: "🏛️", label: "본회의 출석", value: attendDisplay });
  if (asset) facts.push({ icon: "💰", label: "재산", value: asset });

  return (
    <div className="pin-card">
      {vacant && (
        <p className="pin-card-status">{STATUS_LABEL[pin.status] ?? pin.status}</p>
      )}
      <div className="pin-card-header">
        <PoliticianPhoto
          name={pin.name}
          partyColor={color}
          photoUrl={pin.photoUrl}
          size={60}
          showCredit
          shape="circle"
        />
        <div className="pin-card-id">
          <div className="pin-card-name">{pin.name}</div>
          <span
            className="pin-card-party"
            style={{ backgroundColor: color }}
          >
            {pin.party?.shortName ?? pin.party?.name ?? "무소속"}
          </span>
          {district && <div className="pin-card-district">{district}</div>}
        </div>
      </div>

      {facts.length > 0 && (
        <div className="pin-card-facts">
          {facts.map((f) => (
            <div key={f.label} className="pin-card-fact">
              <span className="pin-card-fact-icon">{f.icon}</span>
              <span className="pin-card-fact-label">{f.label}</span>
              <span className="pin-card-fact-value">{f.value}</span>
            </div>
          ))}
        </div>
      )}

      <Link href={`/politicians/${pin.routeId}`} className="pin-card-link">
        자세히 보기 →
      </Link>
    </div>
  );
}

export function VacantDistrictCard({ districtName }: { districtName: string }) {
  return (
    <div className="pin-card pin-card-vacant">
      <p className="pin-card-status">공석</p>
      <div className="pin-card-name">{districtName}</div>
      <div className="pin-card-district">의원 사퇴·궐석</div>
    </div>
  );
}
