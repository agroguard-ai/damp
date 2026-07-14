-- Simplificar collares: cambiar a ID entero autoincremental, remover serial_number, status, firmware_version
-- Remover tabla telemetry_record (legacy, no usada)
-- Crear telemetry_reading sin battery_level
-- Sembrar collar con id=1

-- 1. Drop FK constraints que referencian collar(id)
ALTER TABLE IF EXISTS "animal_collar" DROP CONSTRAINT IF EXISTS "animal_collar_collar_id_fkey";
ALTER TABLE IF EXISTS "telemetry_record" DROP CONSTRAINT IF EXISTS "telemetry_record_collar_id_fkey";

-- 2. Drop tablas que dependen de collar
DROP TABLE IF EXISTS "animal_collar";
DROP TABLE IF EXISTS "telemetry_record";

-- 3. Remover columna legacy collar_id de animal
ALTER TABLE "animal" DROP COLUMN IF EXISTS "collar_id";

-- 4. Drop y recrear collar con id SERIAL
DROP TABLE IF EXISTS "collar";

CREATE TABLE "collar" (
    "id" SERIAL NOT NULL,
    "last_telemetry_date" TIMESTAMP(3),
    CONSTRAINT "collar_pkey" PRIMARY KEY ("id")
);

-- 5. Recrear animal_collar con collar_id INTEGER
CREATE TABLE "animal_collar" (
    "id" TEXT NOT NULL,
    "collar_id" INTEGER NOT NULL,
    "animal_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    CONSTRAINT "animal_collar_pkey" PRIMARY KEY ("id")
);

-- 6. Crear telemetry_reading (simplificado, sin battery_level)
CREATE TABLE "telemetry_reading" (
    "id" TEXT NOT NULL,
    "collar_id" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telemetry_reading_pkey" PRIMARY KEY ("id")
);

-- 7. Reagregar FKs
ALTER TABLE "animal_collar" ADD CONSTRAINT "animal_collar_collar_id_fkey" FOREIGN KEY ("collar_id") REFERENCES "collar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "animal_collar" ADD CONSTRAINT "animal_collar_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "telemetry_reading" ADD CONSTRAINT "telemetry_reading_collar_id_fkey" FOREIGN KEY ("collar_id") REFERENCES "collar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Sembrar primer collar con id=1
INSERT INTO "collar" ("id", "last_telemetry_date") VALUES (1, NULL);
