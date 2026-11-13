-- CreateTable
CREATE TABLE "iot_request_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpoint" TEXT NOT NULL DEFAULT '/api/iot/telemetry',
    "method" TEXT NOT NULL DEFAULT 'POST',
    "ip_address" TEXT,
    "gateway_id" TEXT,
    "gateway_name" TEXT,
    "farm_id" TEXT,
    "farm_name" TEXT,
    "api_key_used" TEXT,
    "collar_id" INTEGER,
    "headers" JSONB,
    "payload" JSONB,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "temp" DOUBLE PRECISION,
    "rssi" DOUBLE PRECISION,
    "snr" DOUBLE PRECISION,
    "status_code" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "response_body" JSONB,
    "error_message" TEXT,
    "downlink_sent" TEXT,
    "duration_ms" INTEGER,

    CONSTRAINT "iot_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "iot_request_logs_created_at_idx" ON "iot_request_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "iot_request_logs_collar_id_idx" ON "iot_request_logs"("collar_id");

-- CreateIndex
CREATE INDEX "iot_request_logs_gateway_id_idx" ON "iot_request_logs"("gateway_id");

-- CreateIndex
CREATE INDEX "iot_request_logs_status_code_idx" ON "iot_request_logs"("status_code");
