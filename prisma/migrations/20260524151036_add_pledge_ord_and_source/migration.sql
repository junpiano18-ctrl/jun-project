-- AlterTable
ALTER TABLE "Pledge" ADD COLUMN "ordNum" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pledge" ADD COLUMN "source" TEXT NOT NULL DEFAULT '중앙선거관리위원회';

-- CreateIndex
CREATE UNIQUE INDEX "Pledge_politicianTermId_ordNum_key" ON "Pledge"("politicianTermId", "ordNum");
