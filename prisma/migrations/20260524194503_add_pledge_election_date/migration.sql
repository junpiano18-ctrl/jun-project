-- AlterTable
ALTER TABLE "Pledge" ADD COLUMN "electionDate" TIMESTAMP(3);

-- 기존 1248건은 모두 8회 지방선거(2022-06-01) sync 결과이므로 일괄 백필.
UPDATE "Pledge" SET "electionDate" = '2022-06-01'::timestamp WHERE "electionDate" IS NULL;
