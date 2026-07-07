ALTER TABLE "Vehicle"
  ADD COLUMN "auctionSource" "AuctionSource",
  ADD COLUMN "listingUrl" TEXT,
  ALTER COLUMN "vin" DROP NOT NULL;

DROP INDEX IF EXISTS "Vehicle_vin_key";

CREATE UNIQUE INDEX "Vehicle_organizationId_vin_key" ON "Vehicle"("organizationId", "vin");
CREATE UNIQUE INDEX "Vehicle_organizationId_listingUrl_key" ON "Vehicle"("organizationId", "listingUrl");