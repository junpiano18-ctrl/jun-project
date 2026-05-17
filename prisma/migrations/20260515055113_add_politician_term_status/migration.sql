-- CreateEnum
CREATE TYPE "PoliticianTermStatus" AS ENUM ('ACTIVE', 'DISMISSED', 'SUSPENDED', 'DECEASED');

-- AlterTable
ALTER TABLE "PoliticianTerm" ADD COLUMN     "status" "PoliticianTermStatus" NOT NULL DEFAULT 'ACTIVE';
