-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "feedback_at" TIMESTAMP(3),
ADD COLUMN     "feedback_note" TEXT,
ADD COLUMN     "feedback_user_id" TEXT,
ADD COLUMN     "is_false_positive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "health_predictions" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "predicted_event" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "detected" BOOLEAN NOT NULL DEFAULT false,
    "horizon_hours" INTEGER NOT NULL DEFAULT 6,
    "window_readings_count" INTEGER NOT NULL DEFAULT 48,
    "alert_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_predictions_animal_id_created_at_idx" ON "health_predictions"("animal_id", "created_at");

-- CreateIndex
CREATE INDEX "health_predictions_predicted_event_detected_idx" ON "health_predictions"("predicted_event", "detected");

-- AddForeignKey
ALTER TABLE "health_predictions" ADD CONSTRAINT "health_predictions_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_predictions" ADD CONSTRAINT "health_predictions_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
