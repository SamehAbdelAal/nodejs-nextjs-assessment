-- AlterTable
ALTER TABLE "ReviewQueueItem" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1;
