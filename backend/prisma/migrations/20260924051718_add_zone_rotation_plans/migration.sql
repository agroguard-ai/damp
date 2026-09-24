-- CreateEnum
CREATE TYPE "ZoneRotationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RotationStepStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP DEFAULT;

-- CreateTable
CREATE TABLE "zone_rotation_plans" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Rotación de Pastoreo',
    "status" "ZoneRotationStatus" NOT NULL DEFAULT 'ACTIVE',
    "frequency_hours" INTEGER NOT NULL DEFAULT 24,
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL DEFAULT 0,
    "auto_rotate" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_rotated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_rotation_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zone_rotation_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_rotation_steps" (
    "id" TEXT NOT NULL,
    "rotation_plan_id" TEXT NOT NULL,
    "geofence_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "status" "RotationStepStatus" NOT NULL DEFAULT 'PENDING',
    "activated_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_rotation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zone_rotation_steps_rotation_plan_id_order_index_key" ON "zone_rotation_steps"("rotation_plan_id", "order_index");

-- AddForeignKey
ALTER TABLE "zone_rotation_plans" ADD CONSTRAINT "zone_rotation_plans_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_rotation_steps" ADD CONSTRAINT "zone_rotation_steps_rotation_plan_id_fkey" FOREIGN KEY ("rotation_plan_id") REFERENCES "zone_rotation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_rotation_steps" ADD CONSTRAINT "zone_rotation_steps_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
