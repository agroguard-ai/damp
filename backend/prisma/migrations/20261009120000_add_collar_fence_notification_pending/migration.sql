-- AlterTable
ALTER TABLE "collars" ADD COLUMN "fence_notification_pending" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "collars" ADD COLUMN "last_fence_synced_at" TIMESTAMP(3);
