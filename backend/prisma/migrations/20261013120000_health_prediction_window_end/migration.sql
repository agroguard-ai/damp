-- Las predicciones del modelo se calculan una vez por ventana de 24 h (48 bloques de 30 min).
-- window_end_at identifica esa ventana; el índice único evita predecir dos veces la misma.
ALTER TABLE "health_predictions" ADD COLUMN "window_end_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "health_predictions_animal_id_predicted_event_window_end_at_key" ON "health_predictions"("animal_id", "predicted_event", "window_end_at");
