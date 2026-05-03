-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ncm" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cnae" TEXT,
ADD COLUMN     "codigoCidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "ie" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "regimeTributario" TEXT;
