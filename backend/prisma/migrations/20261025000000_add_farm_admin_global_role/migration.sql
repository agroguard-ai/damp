-- Nuevo rol global "Administrador de campos": el cliente/productor que crea sus campos y su
-- personal. USER queda solo para operadores y lectores creados por un FARM_ADMIN.
-- El backfill va en una migración aparte: Postgres no deja usar un valor de enum recién
-- agregado dentro de la misma transacción.
ALTER TYPE "GlobalRole" ADD VALUE IF NOT EXISTS 'FARM_ADMIN' AFTER 'SUPER_ADMIN';
