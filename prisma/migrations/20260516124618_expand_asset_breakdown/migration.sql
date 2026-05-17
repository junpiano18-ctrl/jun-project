-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "buildingKrw" BIGINT,
ADD COLUMN     "changeKrw" BIGINT,
ADD COLUMN     "depositKrw" BIGINT,
ADD COLUMN     "disclosedAt" TIMESTAMP(3),
ADD COLUMN     "landKrw" BIGINT,
ADD COLUMN     "stockKrw" BIGINT;
