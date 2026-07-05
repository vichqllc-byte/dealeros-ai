-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "deliveryChecklist" JSONB;

-- AlterTable
ALTER TABLE "SaleDocument" ADD COLUMN     "signatureMethod" TEXT,
ADD COLUMN     "signedByName" TEXT;

