const assert = require("node:assert/strict");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

function createClock(start = Date.UTC(2026, 10, 1)) {
  let now = start;

  class ClockDate extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }

    static now() {
      return now;
    }
  }

  return {
    Date: ClockDate,
    advance(milliseconds) {
      now += milliseconds;
    },
  };
}

const nextServerMock = {
  NextResponse: {
    json(body, init = {}) {
      return { body, status: init.status ?? 200, headers: init.headers ?? {} };
    },
  },
};

const prismaClientMock = {
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
  },
};

function createRateLimitPrisma() {
  const buckets = new Map();

  return {
    buckets,
    rateLimitBucket: {
      async updateMany({ where, data }) {
        const bucket = buckets.get(where.key);

        if (!bucket || bucket.expiresAt > where.expiresAt.lte) {
          return { count: 0 };
        }

        Object.assign(bucket, data);
        return { count: 1 };
      },
      async upsert({ where, create }) {
        const bucket = buckets.get(where.key);

        if (!bucket) {
          buckets.set(where.key, { ...create });
          return { count: create.count, expiresAt: create.expiresAt };
        }

        bucket.count += 1;
        return { count: bucket.count, expiresAt: bucket.expiresAt };
      },
      async deleteMany() {
        return { count: 0 };
      },
    },
  };
}

function loadRateLimit(prisma, clock) {
  return loadTypeScript("src/lib/rate-limit.ts", {
    mocks: {
      "@/lib/prisma": { __esModule: true, default: prisma },
      "@prisma/client": prismaClientMock,
      "next/server": nextServerMock,
    },
    globals: { Date: clock.Date },
  });
}

const rule = { name: "test.rule", limit: 2, windowMs: 60_000 };

test("rate limit allows requests up to the limit and then returns 429", async () => {
  const clock = createClock();
  const prisma = createRateLimitPrisma();
  const { enforceRateLimits } = loadRateLimit(prisma, clock);
  const checks = [{ rule, subject: "203.0.113.7" }];

  assert.equal(await enforceRateLimits(checks), null);
  assert.equal(await enforceRateLimits(checks), null);

  const limited = await enforceRateLimits(checks);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers["Retry-After"], "60");
  assert.match(limited.body.message, /Try again in 1 minute/);
});

test("rate limit starts a new window after the previous one expires", async () => {
  const clock = createClock();
  const prisma = createRateLimitPrisma();
  const { enforceRateLimits } = loadRateLimit(prisma, clock);
  const checks = [{ rule, subject: "user@example.com" }];

  await enforceRateLimits(checks);
  await enforceRateLimits(checks);
  assert.equal((await enforceRateLimits(checks)).status, 429);

  clock.advance(60_000);

  assert.equal(await enforceRateLimits(checks), null);
});

test("rate limit keys are hashed and separate subjects do not share counters", async () => {
  const clock = createClock();
  const prisma = createRateLimitPrisma();
  const { enforceRateLimits } = loadRateLimit(prisma, clock);

  await enforceRateLimits([{ rule, subject: "first@example.com" }]);
  await enforceRateLimits([{ rule, subject: "first@example.com" }]);

  assert.equal(await enforceRateLimits([{ rule, subject: "second@example.com" }]), null);

  for (const key of prisma.buckets.keys()) {
    assert.match(key, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(key, /example\.com/);
  }
});
