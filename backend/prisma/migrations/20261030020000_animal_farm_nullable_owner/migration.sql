-- Un animal puede quedar sin campo (por ejemplo al archivarse su campo),
-- pero conserva un dueño para que el administrador siga viéndolo y pueda reasignarlo.
ALTER TABLE "animals" ADD COLUMN "owner_id" TEXT;

UPDATE "animals" AS a
SET "owner_id" = f."user_id"
FROM "farms" AS f
WHERE a."farm_id" = f."id";

ALTER TABLE "animals" ALTER COLUMN "farm_id" DROP NOT NULL;

ALTER TABLE "animals"
  ADD CONSTRAINT "animals_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "animals_owner_id_idx" ON "animals"("owner_id");
CREATE INDEX "animals_farm_id_idx" ON "animals"("farm_id");
