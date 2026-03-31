-- Add shared fixed-window rate-limit bucket storage for distributed/API-safe throttling.
CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key", "window_start")
);

CREATE INDEX "RateLimitBucket_expires_at_idx" ON "RateLimitBucket"("expires_at");