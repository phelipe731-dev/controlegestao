-- AlterTable
ALTER TABLE "DobradaPauloAlexandreLeader"
ADD COLUMN "monthlyCostCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DobradaPauloAlexandreSupporter" (
    "id" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "birthDate" TIMESTAMP(3),
    "fullAddress" TEXT,
    "city" TEXT,
    "neighborhood" TEXT,
    "notes" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DobradaPauloAlexandreSupporter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreSupporter_leaderId_idx" ON "DobradaPauloAlexandreSupporter"("leaderId");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreSupporter_fullName_idx" ON "DobradaPauloAlexandreSupporter"("fullName");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreSupporter_city_idx" ON "DobradaPauloAlexandreSupporter"("city");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreSupporter_neighborhood_idx" ON "DobradaPauloAlexandreSupporter"("neighborhood");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreSupporter_status_idx" ON "DobradaPauloAlexandreSupporter"("status");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreSupporter_createdAt_idx" ON "DobradaPauloAlexandreSupporter"("createdAt");

-- AddForeignKey
ALTER TABLE "DobradaPauloAlexandreSupporter"
ADD CONSTRAINT "DobradaPauloAlexandreSupporter_leaderId_fkey"
FOREIGN KEY ("leaderId") REFERENCES "DobradaPauloAlexandreLeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
