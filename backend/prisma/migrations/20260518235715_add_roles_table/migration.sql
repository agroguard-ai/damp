/*
  Warnings:

  - You are about to drop the column `role` on the `farm_user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[farm_id,user_id]` on the table `farm_user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `role_id` to the `farm_user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "farm_user" DROP COLUMN "role",
ADD COLUMN     "role_id" TEXT NOT NULL;

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "farm_user_farm_id_user_id_key" ON "farm_user"("farm_id", "user_id");

-- AddForeignKey
ALTER TABLE "farm_user" ADD CONSTRAINT "farm_user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
