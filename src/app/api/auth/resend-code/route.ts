import { NextResponse } from "next/server";

import { RATE_LIMIT_RULES } from "@/constants/rate-limit";
import prisma from "@/lib/prisma";
import {
  createVerificationCode,
  getRequestIp,
  isValidEmail,
  normalizeEmail,
  type AuthCodePurpose,
} from "@/lib/auth";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import { enforceRateLimits } from "@/lib/rate-limit";

function isSupportedPurpose(value: string): value is AuthCodePurpose {
  return value === "EMAIL_VERIFICATION";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    email?: string;
    purpose?: string;
  } | null;

  const email = normalizeEmail(body?.email ?? "");
  const purpose = body?.purpose ?? "";

  const rateLimitResponse = await enforceRateLimits([
    { rule: RATE_LIMIT_RULES.sendCodeByIp, subject: getRequestIp(request) },
    ...(isValidEmail(email) ? [{ rule: RATE_LIMIT_RULES.sendCodeByEmail, subject: email }] : []),
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!email || !purpose) {
    return NextResponse.json({ message: "Email and purpose are required." }, { status: 400 });
  }

  if (!isValidEmail(email) || !isSupportedPurpose(purpose)) {
    return NextResponse.json({ message: "Invalid resend request." }, { status: 400 });
  }

  // Same answer whether or not the account exists or is verified, so this endpoint
  // cannot be used to find out which emails are registered.
  const genericResponse = NextResponse.json({
    message: "If this email has an account waiting for verification, we sent a new code.",
  });

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user || user.emailVerifiedAt) {
    return genericResponse;
  }

  const verification = await createVerificationCode({
    userId: user.id,
    purpose,
  });

  try {
    await sendAuthCodeEmail({
      to: user.email,
      code: verification.code,
      purpose,
    });
  } catch (error) {
    // Logged without the provider response, which can echo the recipient address.
    console.error("[auth] Verification email could not be sent.", error instanceof Error ? error.name : "");
  }

  return genericResponse;
}
