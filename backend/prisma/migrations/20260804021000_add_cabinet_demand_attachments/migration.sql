CREATE TABLE "CabinetDemandAttachment" (
    "id" TEXT NOT NULL,
    "demandId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CabinetDemandAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CabinetDemandAttachment_storedName_key" ON "CabinetDemandAttachment"("storedName");
CREATE INDEX "CabinetDemandAttachment_demandId_idx" ON "CabinetDemandAttachment"("demandId");
CREATE INDEX "CabinetDemandAttachment_createdAt_idx" ON "CabinetDemandAttachment"("createdAt");

ALTER TABLE "CabinetDemandAttachment" ADD CONSTRAINT "CabinetDemandAttachment_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "CabinetDemand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CabinetDemandAttachment" ADD CONSTRAINT "CabinetDemandAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
