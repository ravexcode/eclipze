import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { Prisma } from "@prisma/client";

import {
  AUTH_CODE_SECRET_ENV,
  VERIFICATION_REQUESTER_COOKIE,
  VERIFICATION_REQUESTER_COOKIE_PATH,
} from "@/constants/auth";
import { VERIFICATION_CODE_MAX_ATTEMPTS } from "@/constants/rate-limit";
import prisma from "@/lib/prisma";
import type { UserPlan, UserRole } from "@/types/user";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE_NAME = "token";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 1000 * 60 * 5;
const VERIFICATION_CODE_TTL_MS = 1000 * 60 * 10;

export type AuthCodePurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string) {
  return username.trim();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string) {
  return password.length >= 8;
}

export function isValidUsername(username: string) {
  return /^[a-zA-Z0-9_-]{3,24}$/.test(username);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
}

export function generateVerificationCode(length = 6) {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += randomInt(0, 10).toString();
  }

  return code;
}

function getAuthCodeSecret() {
  const secret = process.env[AUTH_CODE_SECRET_ENV];

  if (!secret) {
    throw new Error(`${AUTH_CODE_SECRET_ENV} is not configured.`);
  }

  return secret;
}

// Keyed with a server secret: a 6-digit code has only 10^6 values, so a plain hash
// leaked from the database could be reversed instantly.
function createCodeHash(userId: string, purpose: AuthCodePurpose, code: string) {
  return createHmac("sha256", getAuthCodeSecret())
    .update(`${userId}:${purpose}:${code}`)
    .digest("hex");
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function serializeUser(user: {
  id: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  role: UserRole;
  plan: UserPlan;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.username ?? user.email.split("@")[0],
    avatarUrl: user.avatarUrl,
    role: user.role,
    plan: user.plan,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt.toISOString(),
  };
}

type PendingCredentials = {
  passwordHash: string;
  username: string;
};

export async function createVerificationCode(input: {
  userId: string;
  purpose: AuthCodePurpose;
  // Email verification codes only: the browser that may use the code.
  requesterTokenHash?: string | null;
  // Email verification codes only: credentials to apply once the email is verified.
  pendingCredentials?: PendingCredentials | null;
  // Resends keep the pending credentials, but only for the browser that chose them.
  inheritPendingCredentials?: boolean;
}) {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  let pendingPasswordHash = input.pendingCredentials?.passwordHash ?? null;
  let pendingUsername = input.pendingCredentials?.username ?? null;

  if (input.inheritPendingCredentials && input.requesterTokenHash && !input.pendingCredentials) {
    const previousCode = await prisma.verificationCode.findFirst({
      where: {
        userId: input.userId,
        purpose: input.purpose,
        consumedAt: null,
        requesterTokenHash: input.requesterTokenHash,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        pendingPasswordHash: true,
        pendingUsername: true,
      },
    });

    pendingPasswordHash = previousCode?.pendingPasswordHash ?? null;
    pendingUsername = previousCode?.pendingUsername ?? null;
  }

  await prisma.verificationCode.deleteMany({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null,
    },
  });

  await prisma.verificationCode.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      codeHash: createCodeHash(input.userId, input.purpose, code),
      requesterTokenHash: input.requesterTokenHash ?? null,
      pendingPasswordHash,
      pendingUsername,
      expiresAt,
    },
  });

  return {
    code,
    expiresAt,
  };
}

/**
 * Returns the hash of this browser's verification token, creating the cookie when it is
 * missing. The cookie lives as long as a code, and each new code refreshes it.
 */
export async function ensureVerificationRequesterTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(VERIFICATION_REQUESTER_COOKIE)?.value || randomBytes(32).toString("base64url");

  cookieStore.set(VERIFICATION_REQUESTER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: VERIFICATION_REQUESTER_COOKIE_PATH,
    maxAge: VERIFICATION_CODE_TTL_MS / 1000,
  });

  return hashSecret(token);
}

export async function readVerificationRequesterTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(VERIFICATION_REQUESTER_COOKIE)?.value;

  return token ? hashSecret(token) : null;
}

export async function clearVerificationRequesterToken() {
  const cookieStore = await cookies();

  cookieStore.delete({
    name: VERIFICATION_REQUESTER_COOKIE,
    path: VERIFICATION_REQUESTER_COOKIE_PATH,
  });
}

type VerificationCodeClient = Pick<Prisma.TransactionClient, "verificationCode">;

function isMatchingHash(storedHash: string, candidateHash: string) {
  const storedBuffer = Buffer.from(storedHash, "hex");
  const candidateBuffer = Buffer.from(candidateHash, "hex");

  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, candidateBuffer);
}

/**
 * Checks a code against the user's latest active code and consumes it on a match.
 * Each check uses one attempt, so a code stops working after
 * VERIFICATION_CODE_MAX_ATTEMPTS guesses even if it has not expired.
 * When `requesterTokenHash` is given, the code must also have been requested by that
 * browser. Returns the consumed code, or null.
 */
async function claimVerificationCode(client: VerificationCodeClient, input: {
  userId: string;
  purpose: AuthCodePurpose;
  code: string;
  requesterTokenHash?: string;
}) {
  const now = new Date();

  const activeCode = await client.verificationCode.findFirst({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: {
        gt: now,
      },
      attempts: {
        lt: VERIFICATION_CODE_MAX_ATTEMPTS,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      codeHash: true,
      requesterTokenHash: true,
      pendingPasswordHash: true,
      pendingUsername: true,
    },
  });

  if (!activeCode) {
    return null;
  }

  // Reserve the attempt before comparing, so parallel guesses cannot exceed the limit.
  const reservedAttempt = await client.verificationCode.updateMany({
    where: {
      id: activeCode.id,
      consumedAt: null,
      attempts: {
        lt: VERIFICATION_CODE_MAX_ATTEMPTS,
      },
    },
    data: {
      attempts: {
        increment: 1,
      },
    },
  });

  if (reservedAttempt.count === 0) {
    return null;
  }

  const candidateHash = createCodeHash(input.userId, input.purpose, input.code);

  if (!isMatchingHash(activeCode.codeHash, candidateHash)) {
    return null;
  }

  if (input.requesterTokenHash !== undefined) {
    const isSameRequester = activeCode.requesterTokenHash !== null &&
      isMatchingHash(activeCode.requesterTokenHash, input.requesterTokenHash);

    if (!isSameRequester) {
      return null;
    }
  }

  const consumedCode = await client.verificationCode.updateMany({
    where: {
      id: activeCode.id,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  });

  return consumedCode.count === 1 ? activeCode : null;
}

/**
 * Verifies an email with a code requested by this browser, then applies the credentials
 * that browser chose at sign-up. A password already on an unverified account was never
 * proven to belong to the email owner, so it is never kept: without pending credentials
 * the password is removed and the owner sets one through password recovery.
 */
export async function verifyEmailWithCode(input: {
  email: string;
  code: string;
  requesterTokenHash: string;
}) {
  const email = normalizeEmail(input.email);

  return prisma.$transaction(async transaction => {
    const user = await transaction.user.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    // A wrong code returns null without throwing, so the used attempt is still committed.
    const claimedCode = await claimVerificationCode(transaction, {
      userId: user.id,
      purpose: "EMAIL_VERIFICATION",
      code: input.code,
      requesterTokenHash: input.requesterTokenHash,
    });

    if (!claimedCode) {
      return null;
    }

    if (user.emailVerifiedAt) {
      return { user, isPasswordRemoved: false };
    }

    let username = user.username;

    if (claimedCode.pendingUsername && claimedCode.pendingUsername !== user.username) {
      const usernameOwner = await transaction.user.findUnique({
        where: { username: claimedCode.pendingUsername },
        select: { id: true },
      });

      if (!usernameOwner) {
        username = claimedCode.pendingUsername;
      }
    }

    const verifiedUser = await transaction.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        passwordHash: claimedCode.pendingPasswordHash,
        username,
      },
    });

    await transaction.authSession.deleteMany({
      where: { userId: user.id },
    });

    return {
      user: verifiedUser,
      isPasswordRemoved: claimedCode.pendingPasswordHash === null,
    };
  });
}

export async function resetPasswordWithCode(input: { email: string; code: string; passwordHash: string }) {
  const email = normalizeEmail(input.email);
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({ where: { email } });

    if (!user?.emailVerifiedAt) {
      return false;
    }

    // A wrong code returns false without throwing, so the used attempt is still committed.
    const claimedCode = await claimVerificationCode(transaction, {
      userId: user.id,
      purpose: "PASSWORD_RESET",
      code: input.code,
    });

    if (!claimedCode) {
      return false;
    }

    await transaction.user.update({
      where: { id: user.id },
      data: { passwordHash: input.passwordHash },
    });

    await transaction.authSession.deleteMany({
      where: { userId: user.id },
    });

    return true;
  });
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSecret(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "Unknown";
}

export function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const device = /mobile|android|iphone|ipad/i.test(userAgent) ? "Mobile device" : "Desktop device";
  const browser = /edg\//i.test(userAgent) ? "Microsoft Edge" : /firefox\//i.test(userAgent) ? "Mozilla Firefox" : /chrome\//i.test(userAgent) ? "Google Chrome" : /safari\//i.test(userAgent) ? "Safari" : "Unknown browser";
  return `${device} · ${browser}`;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.authSession.deleteMany({
      where: {
        tokenHash: hashSecret(token),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Deduplicated per request so layouts, pages, and components share one session lookup
export const getCurrentSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: {
      tokenHash: hashSecret(token),
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.authSession.delete({
      where: {
        id: session.id,
      },
    });

    return null;
  }

  const shouldUpdateActivity = !session.lastUsedAt ||
    Date.now() - session.lastUsedAt.getTime() >= SESSION_ACTIVITY_WRITE_INTERVAL_MS;

  if (shouldUpdateActivity) {
    await prisma.authSession.update({
      where: {
        id: session.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });
  }

  return session;
});

export async function getCurrentUser() {
  const session = await getCurrentSession();

  return session?.user ?? null;
}

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return user;
}
