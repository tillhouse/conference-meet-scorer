-- AlterTable
ALTER TABLE "Meet" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Meet_shareToken_key" ON "Meet"("shareToken");
