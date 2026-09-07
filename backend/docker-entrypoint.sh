#!/bin/sh
set -e

# Aplica las migraciones pendientes contra DATABASE_URL antes de arrancar —
# evita tener que correr `prisma migrate deploy` a mano en cada deploy del VPS.
# Requiere que la extensión PostGIS ya esté habilitada en la base (ver DEPLOY.md).
npx prisma migrate deploy

exec node dist/main.js
