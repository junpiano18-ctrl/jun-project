-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PASSED', 'REJECTED');

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "billName" TEXT NOT NULL,
    "billStatus" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "proposedAt" TIMESTAMP(3),
    "billUrl" TEXT NOT NULL,
    "summary" TEXT,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billId_key" ON "Bill"("billId");

-- CreateIndex
CREATE INDEX "Bill_politicianId_idx" ON "Bill"("politicianId");

-- CreateIndex
CREATE INDEX "Bill_proposedAt_idx" ON "Bill"("proposedAt");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
