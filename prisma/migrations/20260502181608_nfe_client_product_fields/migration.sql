-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cfop" TEXT DEFAULT '5102';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "codigoCidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "state" TEXT;
