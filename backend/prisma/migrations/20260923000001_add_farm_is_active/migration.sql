-- AlterTable
ALTER TABLE "farms" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "farms" ADD COLUMN "archived_at" TIMESTAMP(3);
