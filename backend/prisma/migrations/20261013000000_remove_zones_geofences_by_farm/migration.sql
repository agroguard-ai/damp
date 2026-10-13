-- Se elimina el nivel "Zona": la jerarquía pasa de Campo -> Zona -> Cerco a Campo -> Cerco.
-- Los cercos y los planes de rotación cuelgan directo del campo, y la pastura pasa a ser
-- un dato opcional del cerco.

-- 1. Cercos: farm_id (completado desde la zona) y pastura (copiada de la zona)
ALTER TABLE "geofences" ADD COLUMN "farm_id" TEXT,
ADD COLUMN "pasture_type" TEXT;

UPDATE "geofences" g
SET "farm_id" = z."farm_id",
    "pasture_type" = z."pasture_type"
FROM "zones" z
WHERE g."zone_id" = z."id";

ALTER TABLE "geofences" DROP CONSTRAINT "geofences_zone_id_fkey";
ALTER TABLE "geofences" DROP COLUMN "zone_id";
ALTER TABLE "geofences" ALTER COLUMN "farm_id" SET NOT NULL;
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Animales y gateways ya no se asignan a una zona
ALTER TABLE "animals" DROP CONSTRAINT "animals_zone_id_fkey";
ALTER TABLE "animals" DROP COLUMN "zone_id";

ALTER TABLE "gateways" DROP CONSTRAINT "gateways_zone_id_fkey";
ALTER TABLE "gateways" DROP COLUMN "zone_id";

-- 3. Rotación de pastoreo: los planes pasan a ser por campo (se descartan los planes por zona)
DROP TABLE "zone_rotation_steps";
DROP TABLE "zone_rotation_plans";
DROP TYPE "ZoneRotationStatus";

CREATE TYPE "RotationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "rotation_plans" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Rotación de Pastoreo',
    "status" "RotationStatus" NOT NULL DEFAULT 'ACTIVE',
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

    CONSTRAINT "rotation_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rotation_steps" (
    "id" TEXT NOT NULL,
    "rotation_plan_id" TEXT NOT NULL,
    "geofence_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "status" "RotationStepStatus" NOT NULL DEFAULT 'PENDING',
    "activated_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rotation_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rotation_steps_rotation_plan_id_order_index_key" ON "rotation_steps"("rotation_plan_id", "order_index");

ALTER TABLE "rotation_plans" ADD CONSTRAINT "rotation_plans_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rotation_steps" ADD CONSTRAINT "rotation_steps_rotation_plan_id_fkey" FOREIGN KEY ("rotation_plan_id") REFERENCES "rotation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rotation_steps" ADD CONSTRAINT "rotation_steps_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Zonas
ALTER TABLE "zones" DROP CONSTRAINT "zones_farm_id_fkey";
DROP TABLE "zones";
