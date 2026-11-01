import "server-only";

import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  RATE_LIMIT_CLEANUP_PROBABILITY,
  type RateLimitRule,
} from "@/constants/rate-limit";
import prisma from "@/lib/prisma";
import {
  formatRateLimitMessage,
  getRetryAfterSeconds,
} from "@/utils/rate-limit";

export type RateLimitCheck = {
  rule: RateLimitRule;
  // IP address, normalized email, or user id the counter applies to.
  subject: string;
};

function createBucketKey(check: RateLimitCheck) {
  return createHash("sha256")
    .update(`${check.rule.name}:${check.subject}`)
    .digest("hex");
}

async function incrementBucket(check: RateLimitCheck, now: Date) {
  const key = createBucketKey(check);
  const nextExpiresAt = new Date(now.getTime() + check.rule.windowMs);

  // Start a new window when the stored one has ended. The condition runs inside a single
  // UPDATE, so parallel requests reset the window at most once.
  await prisma.rateLimitBucket.updateMany({
    where: {
      key,
      expiresAt: {
        lte: now,
      },
    },
    data: {
      count: 0,
      windowStart: now,
      expiresAt: nextExpiresAt,
    },
  });

  const upsertBucket = () => prisma.rateLimitBucket.upsert({
    where: {
      key,
    },
    create: {
      key,
      count: 1,
      windowStart: now,
      expiresAt: nextExpiresAt,
    },
    update: {
      count: {
        increment: 1,
      },
    },
    select: {
      count: true,
      expiresAt: true,
    },
  });

  try {
    return await upsertBucket();
  } catch (error) {
    // Two first requests can race to create the same bucket; the loser retries as an update.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return upsertBucket();
    }

    throw error;
  }
}

async function removeExpiredBuckets(now: Date) {
  if (Math.random() >= RATE_LIMIT_CLEANUP_PROBABILITY) {
    return;
  }

  await prisma.rateLimitBucket.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });
}

/**
 * Counts one request against every check and returns a 429 response when any of them is
 * over its limit. Every check is counted, even when an earlier one is already exceeded.
 */
export async function enforceRateLimits(checks: RateLimitCheck[]) {
  const now = new Date();

  const buckets = await Promise.all(
    checks.map(check => incrementBucket(check, now)),
  );

  await removeExpiredBuckets(now);

  const exceededBuckets = buckets.filter((bucket, index) => {
    return bucket.count > checks[index].rule.limit;
  });

  if (exceededBuckets.length === 0) {
    return null;
  }

  const retryAfterSeconds = Math.max(
    ...exceededBuckets.map(bucket => getRetryAfterSeconds(bucket.expiresAt, now)),
  );

  return NextResponse.json(
    {
      message: formatRateLimitMessage(retryAfterSeconds),
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
