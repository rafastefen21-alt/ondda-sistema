-- AlterTable: adiciona classificação ICMS e valores do ST retido ao produto
ALTER TABLE "Product" ADD COLUMN     "icmsCsosn" TEXT DEFAULT '102';
ALTER TABLE "Product" ADD COLUMN     "stBcRetidoUnit" DECIMAL(12,4);
ALTER TABLE "Product" ADD COLUMN     "stAliquotaFinal" DECIMAL(5,2);
ALTER TABLE "Product" ADD COLUMN     "stValorSubstitutoUnit" DECIMAL(12,4);
ALTER TABLE "Product" ADD COLUMN     "stIcmsRetidoUnit" DECIMAL(12,4);
