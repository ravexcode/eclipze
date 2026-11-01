const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const TEST_CODE_SECRET = "test-code-secret";
const ATTACKER_TOKEN_HASH = createHash("sha256").update("attacker-browser").digest("hex");
const VICTIM_TOKEN_HASH = createHash("sha256").update("victim-browser").digest("hex");

function hashCode(userId, code) {
  return createHmac("sha256", TEST_CODE_SECRET)
    .update(`${userId}:EMAIL_VERIFICATION:${code}`)
    .digest("hex");
}

function createDatabase({ user, codes = [] }) {
  const state = {
    users: [user],
    codes: codes.map((code, index) => ({
      id: `code-${index}`,
      userId: user.id,
      purpose: "EMAIL_VERIFICATION",
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(Date.now() + index),
      expiresAt: new Date(Date.now() + 60_000),
      requesterTokenHash: null,
      pendingPasswordHash: null,
      pendingUsername: null,
      ...code,
    })),
    deletedSessionsFor: [],
  };

  const matchesCode = (code, where) => {
    return code.userId === where.userId &&
      code.purpose === where.purpose &&
      (where.consumedAt !== null || code.consumedAt === null) &&
      (!where.expiresAt || code.expiresAt > where.expiresAt.gt) &&
      (!where.attempts || code.attempts < where.attempts.lt) &&
      (where.requesterTokenHash === undefined || code.requesterTokenHash === where.requesterTokenHash);
  };

  const prisma = {
    state,
    async $transaction(callback) {
      return callback(prisma);
    },
    user: {
      async findUnique({ where }) {
        return state.users.find(candidate => {
          return where.email ? candidate.email === where.email : candidate.username === where.username;
        }) ?? null;
      },
      async update({ where, data }) {
        const target = state.users.find(candidate => candidate.id === where.id);
        Object.assign(target, data);
        return { ...target };
      },
    },
    authSession: {
      async deleteMany({ where }) {
        state.deletedSessionsFor.push(where.userId);
        return { count: 0 };
      },
    },
    verificationCode: {
      async findFirst({ where }) {
        const matches = state.codes
          .filter(code => matchesCode(code, where))
          .sort((left, right) => right.createdAt - left.createdAt);

        return matches[0] ? { ...matches[0] } : null;
      },
      async updateMany({ where, data }) {
        const code = state.codes.find(candidate => candidate.id === where.id);

        if (!code || code.consumedAt !== null) return { count: 0 };
        if (where.attempts && code.attempts >= where.attempts.lt) return { count: 0 };
        if (data.attempts) code.attempts += data.attempts.increment;
        if (data.consumedAt) code.consumedAt = data.consumedAt;

        return { count: 1 };
      },
      async deleteMany({ where }) {
        state.codes = state.codes.filter(code => !matchesCode(code, { ...where, consumedAt: undefined }) || code.consumedAt !== null);
        return { count: 0 };
      },
      async create({ data }) {
        const code = {
          id: `code-${state.codes.length + 1}`,
          attempts: 0,
          consumedAt: null,
          createdAt: new Date(),
          ...data,
        };
        state.codes.push(code);
        return code;
      },
    },
  };

  return prisma;
}

function loadAuth(prisma) {
  return loadTypeScript("src/lib/auth.ts", {
    mocks: {
      "@/lib/prisma": { __esModule: true, default: prisma },
      "next/headers": { cookies: async () => ({}) },
      "next/navigation": { redirect() {} },
      react: { cache: callback => callback },
    },
    globals: { Buffer, process: { env: { AUTH_CODE_SECRET: TEST_CODE_SECRET } } },
  });
}

function preRegisteredAccount() {
  return {
    id: "user-1",
    email: "victim@example.com",
    username: "attacker-name",
    passwordHash: "scrypt:attacker:password",
    emailVerifiedAt: null,
  };
}

test("a code requested from another browser cannot verify the email", async () => {
  const prisma = createDatabase({
    user: preRegisteredAccount(),
    codes: [{ codeHash: hashCode("user-1", "123456"), requesterTokenHash: ATTACKER_TOKEN_HASH }],
  });
  const { verifyEmailWithCode } = loadAuth(prisma);

  const result = await verifyEmailWithCode({
    email: "victim@example.com",
    code: "123456",
    requesterTokenHash: VICTIM_TOKEN_HASH,
  });

  assert.equal(result, null);
  assert.equal(prisma.state.users[0].emailVerifiedAt, null);
  assert.equal(prisma.state.codes[0].consumedAt, null);
  assert.equal(prisma.state.codes[0].attempts, 1);
});

test("verifying a pre-registered email applies the verifying browser's credentials", async () => {
  const prisma = createDatabase({
    user: preRegisteredAccount(),
    codes: [{
      codeHash: hashCode("user-1", "123456"),
      requesterTokenHash: VICTIM_TOKEN_HASH,
      pendingPasswordHash: "scrypt:victim:password",
      pendingUsername: "victim-name",
    }],
  });
  const { verifyEmailWithCode } = loadAuth(prisma);

  const result = await verifyEmailWithCode({
    email: "victim@example.com",
    code: "123456",
    requesterTokenHash: VICTIM_TOKEN_HASH,
  });

  assert.equal(result.isPasswordRemoved, false);
  assert.equal(result.user.passwordHash, "scrypt:victim:password");
  assert.equal(result.user.username, "victim-name");
  assert.notEqual(result.user.emailVerifiedAt, null);
  assert.deepEqual(prisma.state.deletedSessionsFor, ["user-1"]);
});

test("verifying without sign-up credentials removes the unproven password", async () => {
  const prisma = createDatabase({
    user: preRegisteredAccount(),
    codes: [{ codeHash: hashCode("user-1", "123456"), requesterTokenHash: VICTIM_TOKEN_HASH }],
  });
  const { verifyEmailWithCode } = loadAuth(prisma);

  const result = await verifyEmailWithCode({
    email: "victim@example.com",
    code: "123456",
    requesterTokenHash: VICTIM_TOKEN_HASH,
  });

  assert.equal(result.isPasswordRemoved, true);
  assert.equal(result.user.passwordHash, null);
  assert.equal(result.user.username, "attacker-name");
});

test("a resend keeps pending credentials only for the browser that chose them", async () => {
  const prisma = createDatabase({
    user: preRegisteredAccount(),
    codes: [{
      codeHash: hashCode("user-1", "111111"),
      requesterTokenHash: VICTIM_TOKEN_HASH,
      pendingPasswordHash: "scrypt:victim:password",
      pendingUsername: "victim-name",
    }],
  });
  const { createVerificationCode } = loadAuth(prisma);

  await createVerificationCode({
    userId: "user-1",
    purpose: "EMAIL_VERIFICATION",
    requesterTokenHash: VICTIM_TOKEN_HASH,
    inheritPendingCredentials: true,
  });

  const victimResend = prisma.state.codes.at(-1);
  assert.equal(victimResend.pendingPasswordHash, "scrypt:victim:password");

  await createVerificationCode({
    userId: "user-1",
    purpose: "EMAIL_VERIFICATION",
    requesterTokenHash: ATTACKER_TOKEN_HASH,
    inheritPendingCredentials: true,
  });

  const attackerResend = prisma.state.codes.at(-1);
  assert.equal(attackerResend.requesterTokenHash, ATTACKER_TOKEN_HASH);
  assert.equal(attackerResend.pendingPasswordHash, null);
  assert.equal(attackerResend.pendingUsername, null);
});

test("an email verification code stops working after five wrong guesses", async () => {
  const prisma = createDatabase({
    user: preRegisteredAccount(),
    codes: [{
      codeHash: hashCode("user-1", "123456"),
      requesterTokenHash: VICTIM_TOKEN_HASH,
      pendingPasswordHash: "scrypt:victim:password",
    }],
  });
  const { verifyEmailWithCode } = loadAuth(prisma);
  const verify = code => verifyEmailWithCode({
    email: "victim@example.com",
    code,
    requesterTokenHash: VICTIM_TOKEN_HASH,
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(await verify(String(100000 + attempt)), null);
  }

  assert.equal(await verify("123456"), null);
  assert.equal(prisma.state.codes[0].consumedAt, null);
});

test("a verification code can be used only once", async () => {
  const prisma = createDatabase({
    user: preRegisteredAccount(),
    codes: [{
      codeHash: hashCode("user-1", "123456"),
      requesterTokenHash: VICTIM_TOKEN_HASH,
      pendingPasswordHash: "scrypt:victim:password",
    }],
  });
  const { verifyEmailWithCode } = loadAuth(prisma);
  const input = { email: "victim@example.com", code: "123456", requesterTokenHash: VICTIM_TOKEN_HASH };

  assert.ok(await verifyEmailWithCode(input));
  assert.equal(await verifyEmailWithCode(input), null);
});
