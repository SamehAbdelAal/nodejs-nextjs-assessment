-- CreateTable
CREATE TABLE "ReviewQueueItem" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQueueItem_announcementId_key" ON "ReviewQueueItem"("announcementId");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_status_claimedBy_idx" ON "ReviewQueueItem"("status", "claimedBy");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_createdAt_idx" ON "ReviewQueueItem"("createdAt");

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
