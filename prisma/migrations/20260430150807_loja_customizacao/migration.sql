-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "lojaBannerUrl" TEXT,
ADD COLUMN     "lojaCorPrimaria" TEXT DEFAULT '#f59e0b',
ADD COLUMN     "lojaDescricao" TEXT,
ADD COLUMN     "lojaLogoUrl" TEXT;
