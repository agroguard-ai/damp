-- Refuerza a nivel DB invariantes que hoy solo se chequean en la aplicación
-- (collars.service.ts / geofences.service.ts), con patrones check-then-insert
-- y close-then-open que no son atómicos frente a requests concurrentes.

-- Un collar solo puede tener una asignación activa (end_at IS NULL) a la vez.
CREATE UNIQUE INDEX "animal_collars_collar_id_active_key"
  ON "animal_collars" ("collar_id") WHERE "end_at" IS NULL;

-- Un animal solo puede tener un collar activo a la vez.
CREATE UNIQUE INDEX "animal_collars_animal_id_active_key"
  ON "animal_collars" ("animal_id") WHERE "end_at" IS NULL;

-- Un animal solo puede estar en una geocerca activa a la vez.
CREATE UNIQUE INDEX "animal_geofences_animal_id_active_key"
  ON "animal_geofences" ("animal_id") WHERE "end_at" IS NULL;
