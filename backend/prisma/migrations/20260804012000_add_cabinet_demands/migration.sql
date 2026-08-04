CREATE TYPE "DemandStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "CabinetDemand" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DemandStatus" NOT NULL DEFAULT 'REQUESTED',
    "requesterName" TEXT NOT NULL,
    "requesterPhone" TEXT NOT NULL,
    "requesterAddress" TEXT NOT NULL,
    "requesterCity" TEXT,
    "requesterNeighborhood" TEXT,
    "responsibleUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CabinetDemand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CabinetDemandHistory" (
    "id" TEXT NOT NULL,
    "demandId" TEXT NOT NULL,
    "previousStatus" "DemandStatus",
    "nextStatus" "DemandStatus" NOT NULL,
    "note" TEXT,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CabinetDemandHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CabinetDemand_status_idx" ON "CabinetDemand"("status");
CREATE INDEX "CabinetDemand_responsibleUserId_idx" ON "CabinetDemand"("responsibleUserId");
CREATE INDEX "CabinetDemand_requesterCity_idx" ON "CabinetDemand"("requesterCity");
CREATE INDEX "CabinetDemand_requesterNeighborhood_idx" ON "CabinetDemand"("requesterNeighborhood");
CREATE INDEX "CabinetDemand_createdAt_idx" ON "CabinetDemand"("createdAt");
CREATE INDEX "CabinetDemand_resolvedAt_idx" ON "CabinetDemand"("resolvedAt");
CREATE INDEX "CabinetDemandHistory_demandId_idx" ON "CabinetDemandHistory"("demandId");
CREATE INDEX "CabinetDemandHistory_createdAt_idx" ON "CabinetDemandHistory"("createdAt");

ALTER TABLE "CabinetDemand" ADD CONSTRAINT "CabinetDemand_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CabinetDemand" ADD CONSTRAINT "CabinetDemand_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CabinetDemandHistory" ADD CONSTRAINT "CabinetDemandHistory_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "CabinetDemand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CabinetDemandHistory" ADD CONSTRAINT "CabinetDemandHistory_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
