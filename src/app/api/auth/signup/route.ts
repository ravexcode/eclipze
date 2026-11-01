import { NextResponse } from "next/server";

import { RATE_LIMIT_RULES } from "@/constants/rate-limit";
import prisma from "@/lib/prisma";
import { createInitialAiCreditGrant } from "@/lib/ai-credits";
import {
  createVerificationCode,
  getRequestIp,
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from "@/lib/auth";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import { enforceRateLimits } from "@/lib/rate-limit";
import { notifySecurityEvent } from "@/lib/security-email";

async function sendVerificationCode(userId: string, email: string) {
  const verification = await createVerificationCode({
    userId,
    purpose: "EMAIL_VERIFICATION",
  });

  try {
    await sendAuthCodeEmail({
      to: email,
      code: verification.code,
      purpose: "EMAIL_VERIFICATION",
    });

    return true;
  } catch {
    return false;
  }
}

function createVerificationStepResponse(email: string, isSent: boolean) {
  if (!isSent) {
    return NextResponse.json({
      message: "Account created, but email delivery is not configured yet. Add RESEND_API_KEY and AUTH_EMAIL_FROM, then resend the verification code.",
      nextStep: "verify_email",
      email,
      warning: true,
    }, { status: 202 });
  }

  return NextResponse.json({
    message: "Account created. We sent a verification code to your email.",
    nextStep: "verify_email",
    email,
  }, { status: 201 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    email?: string;
    username?: string;
    password?: string;
    password_confirm?: string;
  } | null;

  const email = normalizeEmail(body?.email ?? "");
  const username = normalizeUsername(body?.username ?? "");
  const password = body?.password ?? "";
  const passwordConfirm = body?.password_confirm ?? "";

  if (!email || !username || !password || !passwordConfirm) {
    return NextResponse.json({ message: "Email, username, password, and password confirmation are required." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
  }

  if (!isValidUsername(username)) {
    return NextResponse.json({ message: "Username must be 3-24 characters and use only letters, numbers, underscores, or hyphens." }, { status: 400 });
  }

  if (!isValidPassword(password)) {
    return NextResponse.json({ message: "Password must be at least 8 characters long." }, { status: 400 });
  }

  if (password !== passwordConfirm) {
    return NextResponse.json({ message: "Passwords do not match." }, { status: 400 });
  }

  // Counted after input validation, so typos do not use up the limit, and before the
  // account lookup, so the "already exists" answer cannot be probed at scale.
  const rateLimitResponse = await enforceRateLimits([
    { rule: RATE_LIMIT_RULES.signUpByIp, subject: getRequestIp(request) },
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const [existingByEmail, existingByUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ]);

  // Usernames are public, so a taken username can be reported directly.
  if (existingByUsername && existingByUsername.id !== existingByEmail?.id) {
    return NextResponse.json({ message: "That username is already taken." }, { status: 409 });
  }

  // Hashed on every path, so a known email takes as long to answer as a new one.
  const passwordHash = await hashPassword(password);

  if (existingByEmail) {
    // Answer exactly like a new sign-up, so this endpoint does not reveal which emails
    // have accounts. An unverified owner gets a fresh code to finish verification.
    if (existingByEmail.emailVerifiedAt) {
      notifySecurityEvent(request, { to: email, kind: "SIGNUP_ATTEMPT" });
      return createVerificationStepResponse(email, true);
    }

    const isSent = await sendVerificationCode(existingByEmail.id, email);
    return createVerificationStepResponse(email, isSent);
  }

  const user = await prisma.$transaction(async transaction => {
    const createdUser = await transaction.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: "USER",
      },
    });
    await createInitialAiCreditGrant(transaction, createdUser.id);
    return createdUser;
  });

  const isSent = await sendVerificationCode(user.id, email);
  return createVerificationStepResponse(email, isSent);
}
