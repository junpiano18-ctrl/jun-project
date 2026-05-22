-- VoteResult enum + VoteRecord 테이블 추가.

CREATE TYPE "VoteResult" AS ENUM ('AGREE', 'DISAGREE', 'ABSTAIN', 'ABSENT');

CREATE TABLE "VoteRecord" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "billName" TEXT NOT NULL,
    "voteDate" TIMESTAMP(3) NOT NULL,
    "result" "VoteResult" NOT NULL,
    "billUrl" TEXT,
    "sessionCd" INTEGER,
    "currentsCd" INTEGER,
    "age" INTEGER NOT NULL,

    CONSTRAINT "VoteRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoteRecord_politicianId_billId_key" ON "VoteRecord"("politicianId", "billId");
CREATE INDEX "VoteRecord_politicianId_voteDate_idx" ON "VoteRecord"("politicianId", "voteDate");
CREATE INDEX "VoteRecord_billId_idx" ON "VoteRecord"("billId");

ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_politicianId_fkey"
  FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
