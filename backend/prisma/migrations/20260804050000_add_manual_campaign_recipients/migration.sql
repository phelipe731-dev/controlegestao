ALTER TYPE "CampaignAudienceType" ADD VALUE IF NOT EXISTS 'MANUAL_LIST';

ALTER TABLE "CampaignRecipient" DROP CONSTRAINT IF EXISTS "CampaignRecipient_supporterId_fkey";

ALTER TABLE "CampaignRecipient" ALTER COLUMN "supporterId" DROP NOT NULL;

ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

CREATE INDEX IF NOT EXISTS "CampaignRecipient_phone_idx" ON "CampaignRecipient"("phone");

ALTER TABLE "CampaignRecipient"
  ADD CONSTRAINT "CampaignRecipient_supporterId_fkey"
  FOREIGN KEY ("supporterId") REFERENCES "Supporter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
