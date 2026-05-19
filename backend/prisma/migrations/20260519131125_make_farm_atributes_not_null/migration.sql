/*
  Warnings:

  - Made the column `name` on table `farm` required. This step will fail if there are existing NULL values in that column.
  - Made the column `address` on table `farm` required. This step will fail if there are existing NULL values in that column.
  - Made the column `province` on table `farm` required. This step will fail if there are existing NULL values in that column.
  - Made the column `total_area_ha` on table `farm` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "farm" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "province" SET NOT NULL,
ALTER COLUMN "total_area_ha" SET NOT NULL;
