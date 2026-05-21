-- PoliticianTerm: 법원 판결 정보 4필드 추가.
-- 수사·기소 단계는 표시하지 않음 — 판결문(1심 이상)만 채움.
ALTER TABLE "PoliticianTerm" ADD COLUMN "courtRulingDate" TIMESTAMP(3);
ALTER TABLE "PoliticianTerm" ADD COLUMN "courtRulingSummary" TEXT;
ALTER TABLE "PoliticianTerm" ADD COLUMN "courtRulingFinal" BOOLEAN;
ALTER TABLE "PoliticianTerm" ADD COLUMN "courtRulingSource" TEXT;
