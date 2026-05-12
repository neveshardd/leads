-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "webSourceUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_webSourceUrl_key" ON "Lead"("webSourceUrl");
