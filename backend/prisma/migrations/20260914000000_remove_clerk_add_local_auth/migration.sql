-- Migration: remove clerk_id, add password_hash and name to users
ALTER TABLE "users" DROP COLUMN IF EXISTS "clerk_id";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'farms_user_id_fkey'
  ) THEN
    ALTER TABLE "farms" ADD CONSTRAINT "farms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
