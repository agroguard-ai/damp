-- CreateEnum
CREATE TYPE "CollarClaimStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CollarRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "collar_claims" (
    "id" TEXT NOT NULL,
    "collar_id" INTEGER NOT NULL,
    "farm_id" TEXT,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "CollarClaimStatus" NOT NULL DEFAULT 'PENDING',
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "collar_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collar_requests" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_count" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "CollarRequestStatus" NOT NULL DEFAULT 'PENDING',
    "response_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "collar_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "collar_claims" ADD CONSTRAINT "collar_claims_collar_id_fkey" FOREIGN KEY ("collar_id") REFERENCES "collars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collar_claims" ADD CONSTRAINT "collar_claims_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collar_claims" ADD CONSTRAINT "collar_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collar_requests" ADD CONSTRAINT "collar_requests_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collar_requests" ADD CONSTRAINT "collar_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
