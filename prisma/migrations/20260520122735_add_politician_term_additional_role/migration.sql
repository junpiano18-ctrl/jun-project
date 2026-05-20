-- PoliticianTerm: 본 직무 외 겸직(장관 등) 필드 추가.
ALTER TABLE "PoliticianTerm" ADD COLUMN "additionalRole" TEXT;
ALTER TABLE "PoliticianTerm" ADD COLUMN "additionalRoleStartDate" TIMESTAMP(3);
ALTER TABLE "PoliticianTerm" ADD COLUMN "additionalRoleSource" TEXT;
