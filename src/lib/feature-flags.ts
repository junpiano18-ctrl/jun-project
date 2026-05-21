// UI 토글 플래그. 데이터 신뢰도/구현 미비로 일시 숨길 필요가 있는 항목.
// 검증 완료 시 해당 플래그 false 로 바꾸면 복원.

// 출석률 — 현재 거의 모든 의원이 100%로 잡혀 계산 방식 의심.
// popup card + detail page 양쪽에서 숨김. PoliticianTerm.attendanceRate /
// plenaryVoteAttendCount / plenaryVoteSessionCount 데이터는 DB에 그대로 보존.
export const HIDE_ATTENDANCE = true;
