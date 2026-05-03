-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "scheduledDeliveryDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cnpj" TEXT;
