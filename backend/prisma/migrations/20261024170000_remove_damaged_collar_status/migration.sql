-- Convert any existing DAMAGED collar to AVAILABLE
UPDATE "collars" SET "status" = 'AVAILABLE' WHERE "status"::text = 'DAMAGED';

-- In PostgreSQL, altering an enum to remove a value requires updating the type
-- Create new enum type, cast column, drop old type, rename new type
CREATE TYPE "CollarStatus_new" AS ENUM ('AVAILABLE', 'OUT_OF_SERVICE');
ALTER TABLE "collars" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "collars" ALTER COLUMN "status" TYPE "CollarStatus_new" USING ("status"::text::"CollarStatus_new");
ALTER TYPE "CollarStatus" RENAME TO "CollarStatus_old";
ALTER TYPE "CollarStatus_new" RENAME TO "CollarStatus";
DROP TYPE "CollarStatus_old";
ALTER TABLE "collars" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
