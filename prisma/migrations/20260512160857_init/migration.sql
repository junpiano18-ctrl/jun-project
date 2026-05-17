-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('NATIONAL_ASSEMBLY', 'METRO_GOVERNOR', 'LOCAL_GOVERNOR', 'METRO_COUNCIL', 'LOCAL_COUNCIL', 'EDUCATION_SUPERINTENDENT');

-- CreateEnum
CREATE TYPE "ElectedAs" AS ENUM ('CONSTITUENCY', 'PROPORTIONAL');

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "color" TEXT NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "positionType" "PositionType" NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRegion" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentCode" TEXT,
    "geometry" JSONB NOT NULL,

    CONSTRAINT "AdminRegion_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "positionType" "PositionType" NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isProportional" BOOLEAN NOT NULL DEFAULT false,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictRegion" (
    "districtId" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,

    CONSTRAINT "DistrictRegion_pkey" PRIMARY KEY ("districtId","regionCode")
);

-- CreateTable
CREATE TABLE "Politician" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hanjaName" TEXT,
    "birthYear" INTEGER,
    "gender" TEXT,
    "photoUrl" TEXT,
    "monaCd" TEXT,
    "necId" TEXT,
    "ethicsId" TEXT,

    CONSTRAINT "Politician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticianTerm" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "partyId" TEXT,
    "positionTitle" TEXT NOT NULL,
    "electedAs" "ElectedAs" NOT NULL,
    "electedDate" TIMESTAMP(3) NOT NULL,
    "attendanceRate" DOUBLE PRECISION,
    "pledgeFulfillRate" DOUBLE PRECISION,

    CONSTRAINT "PoliticianTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pledge" (
    "id" TEXT NOT NULL,
    "politicianTermId" TEXT NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "easySummary" TEXT,
    "summaryModel" TEXT,
    "summaryUpdatedAt" TIMESTAMP(3),
    "status" TEXT,

    CONSTRAINT "Pledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalKrw" BIGINT NOT NULL,
    "detail" JSONB,
    "source" TEXT NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "politicianTermId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "billName" TEXT NOT NULL,
    "voteDate" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "politicianTermId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sessionName" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_name_key" ON "Party"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Term_positionType_number_key" ON "Term"("positionType", "number");

-- CreateIndex
CREATE INDEX "District_positionType_idx" ON "District"("positionType");

-- CreateIndex
CREATE UNIQUE INDEX "District_positionType_name_key" ON "District"("positionType", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Politician_monaCd_key" ON "Politician"("monaCd");

-- CreateIndex
CREATE UNIQUE INDEX "Politician_necId_key" ON "Politician"("necId");

-- CreateIndex
CREATE UNIQUE INDEX "Politician_ethicsId_key" ON "Politician"("ethicsId");

-- CreateIndex
CREATE INDEX "Politician_name_idx" ON "Politician"("name");

-- CreateIndex
CREATE INDEX "PoliticianTerm_districtId_idx" ON "PoliticianTerm"("districtId");

-- CreateIndex
CREATE INDEX "PoliticianTerm_partyId_idx" ON "PoliticianTerm"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticianTerm_politicianId_termId_key" ON "PoliticianTerm"("politicianId", "termId");

-- CreateIndex
CREATE INDEX "Pledge_politicianTermId_idx" ON "Pledge"("politicianTermId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_politicianId_year_key" ON "Asset"("politicianId", "year");

-- CreateIndex
CREATE INDEX "Vote_politicianTermId_idx" ON "Vote"("politicianTermId");

-- CreateIndex
CREATE INDEX "Vote_billId_idx" ON "Vote"("billId");

-- CreateIndex
CREATE INDEX "Attendance_politicianTermId_idx" ON "Attendance"("politicianTermId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- AddForeignKey
ALTER TABLE "DistrictRegion" ADD CONSTRAINT "DistrictRegion_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictRegion" ADD CONSTRAINT "DistrictRegion_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "AdminRegion"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticianTerm" ADD CONSTRAINT "PoliticianTerm_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticianTerm" ADD CONSTRAINT "PoliticianTerm_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticianTerm" ADD CONSTRAINT "PoliticianTerm_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticianTerm" ADD CONSTRAINT "PoliticianTerm_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_politicianTermId_fkey" FOREIGN KEY ("politicianTermId") REFERENCES "PoliticianTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_politicianTermId_fkey" FOREIGN KEY ("politicianTermId") REFERENCES "PoliticianTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_politicianTermId_fkey" FOREIGN KEY ("politicianTermId") REFERENCES "PoliticianTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
