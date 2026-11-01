import { NextResponse } from "next/server";

import { RATE_LIMIT_RULES } from "@/constants/rate-limit";
import {
  clearVerificationRequesterToken,
  createSession,
  getRequestIp,
  isValidEmail,
  normalizeEmail,
  readVerificationRequesterTokenHash,
  verifyEmailWithCode,
} from "@/lib/auth";
import { recordCurrentLegalAcceptance } from "@/lib/legal-acceptance";
import { enforceRateLimits } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimitResponse = await enforceRateLimits([
    { rule: RATE_LIMIT_RULES.verifyCodeByIp, subject: getRequestIp(request) },
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = await request.json().catch(() => null) as {
    email?: string;
    code?: string;
  } | null;

  const email = normalizeEmail(body?.email ?? "");
  const code = (body?.code ?? "").trim();

  if (!email || !code) {
    return NextResponse.json({ message: "Email and verification code are required." }, { status: 400 });
  }

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: "Please enter a valid email and a 6-digit verification code." }, { status: 400 });
  }

  const invalidCodeResponse = NextResponse.json(
    { message: "Invalid or expired verification code. Request a new code from this browser." },
    { status: 400 },
  );

  // Codes only work in the browser that requested them, so a code requested by someone
  // else (for example, an attacker who pre-registered this email) cannot be used.
  const requesterTokenHash = await readVerificationRequesterTokenHash();

  if (!requesterTokenHash) {
    return invalidCodeResponse;
  }

  const verification = await verifyEmailWithCode({
    email,
    code,
    requesterTokenHash,
  });

  if (!verification) {
    return invalidCodeResponse;
  }

  await clearVerificationRequesterToken();
  await recordCurrentLegalAcceptance(verification.user.id);
  await createSession(verification.user.id);

  return NextResponse.json({
    message: verification.isPasswordRemoved
      ? "Email verified. You are now signed in. Set a password with password recovery before you sign in again."
      : "Email verified. You are now signed in.",
    redirectTo: "/dashboard",
  });
}
