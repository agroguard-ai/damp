-- Agrega el campo RENSPA (Registro Nacional Sanitario de Productores Agropecuarios, SENASA)
-- al alta de campos. Opcional: campos ya existentes quedan con NULL.
ALTER TABLE "farms" ADD COLUMN "renspa" TEXT;
