-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COMPLIANCE_OFFICER';

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "Announcement_status_idx" ON "Announcement"("status");
