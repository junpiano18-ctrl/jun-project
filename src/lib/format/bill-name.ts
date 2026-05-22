// 법안명에서 메타 정보(괄호 부분) 분리.
// 예: "녹색건축물 조성 지원법 일부개정법률안(대안)(국토교통위원장)"
//   → { main: "녹색건축물 조성 지원법 일부개정법률안", suffix: "(대안)(국토교통위원장)" }
// 본문 끝에 붙은 연속된 괄호 블록만 분리. 본문 중간의 괄호는 유지.
export function splitBillName(name: string): { main: string; suffix: string | null } {
  const m = name.match(/^(.+?)\s*((?:\([^)]+\)\s*)+)$/);
  if (m) return { main: m[1].trim(), suffix: m[2].replace(/\s+/g, "").trim() };
  return { main: name, suffix: null };
}
