-- PlenaryBill: 본회의 처리 안건 마스터 (Bill과 별도).
CREATE TABLE "PlenaryBill" (
    "billId" TEXT NOT NULL,
    "billName" TEXT NOT NULL,
    "billUrl" TEXT,
    "age" INTEGER NOT NULL DEFAULT 22,
    "procDate" TIMESTAMP(3),
    "voteTcnt" INTEGER,
    "yesTcnt" INTEGER,
    "noTcnt" INTEGER,
    "blankTcnt" INTEGER,
    "summary" TEXT,
    "summaryModel" TEXT,
    "summaryUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "PlenaryBill_pkey" PRIMARY KEY ("billId")
);

CREATE INDEX "PlenaryBill_procDate_idx" ON "PlenaryBill"("procDate");
