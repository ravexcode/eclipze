const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
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

function createAuthPrisma({ userId, codeHash }) {
  const user = { id: userId, email: "user@example.com", emailVerifiedAt: new Date() };
  const code = {
    id: "code-1",
    userId,
    purpose: "EMAIL_VERIFICATION",
    codeHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };

  return {
    code,
    user: {
      async findUnique() {
        return user;
      },
    },
    verificationCode: {
      async findFirst({ where }) {
        const isActive = code.consumedAt === null &&
          code.expiresAt > where.expiresAt.gt &&
          code.attempts < where.attempts.lt;

        return isActive ? { id: code.id, codeHash: code.codeHash } : null;
      },
      async updateMany({ where, data }) {
        if (code.consumedAt !== null) {
          return { count: 0 };
        }

        if (where.attempts && code.attempts >= where.attempts.lt) {
          return { count: 0 };
        }

        if (data.attempts) {
          code.attempts += data.attempts.increment;
        }

        if (data.consumedAt) {
          code.consumedAt = data.consumedAt;
        }

        return { count: 1 };
      },
    },
  };
}

function loadAuth(prisma) {
  return loadTypeScript("src/lib/auth.ts", {
    mocks: {
      "@/lib/prisma": { __esModule: true, default: prisma },
      "next/headers": { cookies: async () => ({}) },
      "next/navigation": { redirect() {} },
      react: { cache: callback => callback },
    },
    globals: { Buffer },
  });
}

function hashCode(userId, code) {
  return createHash("sha256").update(`${userId}:EMAIL_VERIFICATION:${code}`).digest("hex");
}

test("verification code is consumed once when the code matches", async () => {
  const prisma = createAuthPrisma({ userId: "user-1", codeHash: hashCode("user-1", "123456") });
  const { consumeVerificationCode } = loadAuth(prisma);
  const input = { email: "user@example.com", purpose: "EMAIL_VERIFICATION", code: "123456" };

  assert.equal((await consumeVerificationCode(input)).id, "user-1");
  assert.equal(await consumeVerificationCode(input), null);
});

test("verification code stops working after five wrong guesses", async () => {
  const prisma = createAuthPrisma({ userId: "user-1", codeHash: hashCode("user-1", "123456") });
  const { consumeVerificationCode } = loadAuth(prisma);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await consumeVerificationCode({
      email: "user@example.com",
      purpose: "EMAIL_VERIFICATION",
      code: String(100000 + attempt),
    });

    assert.equal(result, null);
  }

  assert.equal(prisma.code.attempts, 5);

  const correctCodeResult = await consumeVerificationCode({
    email: "user@example.com",
    purpose: "EMAIL_VERIFICATION",
    code: "123456",
  });

  assert.equal(correctCodeResult, null);
  assert.equal(prisma.code.consumedAt, null);
});
