-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SUPER_ADMIN', 'USER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "global_role" "GlobalRole" NOT NULL DEFAULT 'USER';

-- DropForeignKey
ALTER TABLE "farm_users" DROP CONSTRAINT IF EXISTS "farm_users_farm_id_fkey";
ALTER TABLE "farm_users" DROP CONSTRAINT IF EXISTS "farm_users_user_id_fkey";

-- AddForeignKey
ALTER TABLE "farm_users" ADD CONSTRAINT "farm_users_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "farm_users" ADD CONSTRAINT "farm_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
