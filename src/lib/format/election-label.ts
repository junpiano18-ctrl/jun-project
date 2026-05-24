// 선거일자(electionDate) → 사람이 읽는 라벨.
//
// 알려진 굵직한 선거는 사전 매핑 (sgId 우선 정확). 그 외엔 월 기준 휴리스틱.
//   "20220601" → "2022년 6월 지방선거"
//   "20240410" → "2024년 4월 총선 (22대)"
//   기타       → "YYYY년 M월 재보선" (보궐 추정)
//
// 입력은 Date | string(YYYYMMDD/YYYY-MM-DD) 둘 다 받음.

const KNOWN: Record<string, string> = {
  // sgId YYYYMMDD 키.
  "20220309": "2022년 3월 대선 (20대)",
  "20220601": "2022년 6월 지방선거 (8회)",
  "20240410": "2024년 4월 총선 (22대)",
};

function toIsoDate(d: Date | string): string {
  if (typeof d === "string") {
    // 20220601 or 2022-06-01
    const digits = d.replace(/\D/g, "");
    if (digits.length === 8) return digits;
  }
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function formatElectionLabel(d: Date | string | null): string | null {
  if (!d) return null;
  const sgId = toIsoDate(d);
  if (sgId.length !== 8) return null;
  if (KNOWN[sgId]) return KNOWN[sgId];

  const year = sgId.slice(0, 4);
  const month = parseInt(sgId.slice(4, 6), 10);
  // 휴리스틱: 보통 대선 3월, 총선 4월, 지선 6월. 그 외 시기는 재보선으로 추정.
  if (month === 3) return `${year}년 ${month}월 대선`;
  if (month === 4) return `${year}년 ${month}월 총선`;
  if (month === 6) return `${year}년 ${month}월 지방선거`;
  return `${year}년 ${month}월 재보선`;
}
