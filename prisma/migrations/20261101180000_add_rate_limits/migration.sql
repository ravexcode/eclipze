-- Counts checks against each verification code so a code is rejected after too many guesses.
ALTER TABLE "verification_codes" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- Fixed-window request counters for sensitive endpoints.
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "rate_limit_buckets"("expiresAt");
