-- CreateTable
CREATE TABLE "DobradaPauloAlexandreLeader" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cpf" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "email" TEXT,
    "fullAddress" TEXT,
    "city" TEXT,
    "neighborhood" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DobradaPauloAlexandreLeader_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreLeader_fullName_idx" ON "DobradaPauloAlexandreLeader"("fullName");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreLeader_city_idx" ON "DobradaPauloAlexandreLeader"("city");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreLeader_neighborhood_idx" ON "DobradaPauloAlexandreLeader"("neighborhood");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreLeader_status_idx" ON "DobradaPauloAlexandreLeader"("status");

-- CreateIndex
CREATE INDEX "DobradaPauloAlexandreLeader_createdAt_idx" ON "DobradaPauloAlexandreLeader"("createdAt");

-- AddForeignKey
ALTER TABLE "DobradaPauloAlexandreLeader" ADD CONSTRAINT "DobradaPauloAlexandreLeader_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DobradaPauloAlexandreLeader" ADD CONSTRAINT "DobradaPauloAlexandreLeader_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
