/*
  Warnings:

  - You are about to drop the column `animal_type` on the `animal` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('ESCAPE', 'HEALTH', 'SYSTEM');

-- AlterTable
ALTER TABLE "animal" DROP COLUMN "animal_type",
ADD COLUMN     "animal_type_id" TEXT,
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "zone_id" TEXT;

-- AlterTable
ALTER TABLE "farm" ADD COLUMN     "location" TEXT,
ADD COLUMN     "user_id" TEXT;

-- DropEnum
DROP TYPE "AnimalType";

-- CreateTable
CREATE TABLE "zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pasture_type" TEXT,
    "farm_id" TEXT NOT NULL,
    "polygon_coordinates" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "animal_type_name_key" ON "animal_type"("name");

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_animal_type_id_fkey" FOREIGN KEY ("animal_type_id") REFERENCES "animal_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone" ADD CONSTRAINT "zone_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
