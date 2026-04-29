-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AnimalType" AS ENUM ('COW');

-- CreateEnum
CREATE TYPE "MedicalEventType" AS ENUM ('VACCINATION', 'TREATMENT', 'SURGERY');

-- CreateTable
CREATE TABLE "farm" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "province" TEXT,
    "total_area_ha" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farm_user" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role",

    CONSTRAINT "farm_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "area_ha" DOUBLE PRECISION,
    "geometry" geometry(Polygon, 4326),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofence" (
    "id" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "name" TEXT,
    "geometry" geometry(Polygon, 4326),
    "active" BOOLEAN,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "tag" TEXT,
    "sex" "Sex",
    "birth_date" TIMESTAMP(3),
    "breed" TEXT,
    "weight_kg" DOUBLE PRECISION,
    "animal_type" "AnimalType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collar" (
    "id" TEXT NOT NULL,
    "serial_number" TEXT,
    "status" TEXT,
    "firmware_version" TEXT,

    CONSTRAINT "collar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_collar" (
    "id" TEXT NOT NULL,
    "collar_id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),

    CONSTRAINT "animal_collar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_event" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "type" "MedicalEventType",
    "description" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_record" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "collar_id" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "heart_rate" DOUBLE PRECISION,
    "location" geometry(Polygon, 4326),
    "recorded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telemetry_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_geofence" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "geofence_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),

    CONSTRAINT "animal_geofence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collar_serial_number_key" ON "collar"("serial_number");

-- AddForeignKey
ALTER TABLE "farm_user" ADD CONSTRAINT "farm_user_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_user" ADD CONSTRAINT "farm_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sector" ADD CONSTRAINT "sector_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence" ADD CONSTRAINT "geofence_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_collar" ADD CONSTRAINT "animal_collar_collar_id_fkey" FOREIGN KEY ("collar_id") REFERENCES "collar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_collar" ADD CONSTRAINT "animal_collar_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_event" ADD CONSTRAINT "medical_event_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_record" ADD CONSTRAINT "telemetry_record_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_record" ADD CONSTRAINT "telemetry_record_collar_id_fkey" FOREIGN KEY ("collar_id") REFERENCES "collar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_geofence" ADD CONSTRAINT "animal_geofence_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_geofence" ADD CONSTRAINT "animal_geofence_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
