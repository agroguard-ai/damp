-- AlterTable
ALTER TABLE "collars" ADD COLUMN "farm_id" TEXT;

-- AddForeignKey
ALTER TABLE "collars" ADD CONSTRAINT "collars_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
