-- Snapshot del campo en cada lectura de telemetría.
-- Se completa al ingerir nuevas lecturas y, para las históricas, se atribuye
-- on-demand al consultar el mapa de calor de un campo.
ALTER TABLE "telemetry_readings" ADD COLUMN "farm_id" TEXT;

ALTER TABLE "telemetry_readings"
  ADD CONSTRAINT "telemetry_readings_farm_id_fkey"
  FOREIGN KEY ("farm_id") REFERENCES "farms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "telemetry_readings_farm_id_timestamp_idx"
  ON "telemetry_readings"("farm_id", "timestamp");
