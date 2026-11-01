import { NextResponse } from "next/server";

import { DUMMY_PASSWORD_HASH } from "@/constants/auth";
import { RATE_LIMIT_RULES } from "@/constants/rate-limit";
import prisma from "@/lib/prisma";
import {
  createSession,
  describeDevice,
  getRequestIp,
  isValidEmail,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth";
import { sendNewSignInEmail } from "@/lib/auth-email";
import { sendEmailAfterResponse } from "@/lib/email-delivery";
import { recordCurrentLegalAcceptance } from "@/lib/legal-acceptance";
import { enforceRateLimits } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    email?: string;
    password?: string;
  } | null;

  const email = normalizeEmail(body?.email ?? "");
  const password = body?.password ?? "";

  // Runs before the password hash check, which is the expensive step attackers target.
  const rateLimitResponse = await enforceRateLimits([
    { rule: RATE_LIMIT_RULES.signInByIp, subject: getRequestIp(request) },
    ...(isValidEmail(email) ? [{ rule: RATE_LIMIT_RULES.signInByEmail, subject: email }] : []),
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user?.passwordHash) {
    // Spend the same hashing time as a real check, so response time does not reveal
    // whether the email has a password account.
    await verifyPassword(password, DUMMY_PASSWORD_HASH);

    return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
  }

  if (!user.emailVerifiedAt) {
    return NextResponse.json({
      message: "Please verify your email before signing in.",
      actionHref: "/auth/verify-email",
      actionLabel: "Verify email",
    }, { status: 403 });
  }

  await recordCurrentLegalAcceptance(user.id);
  await createSession(user.id);
  // Captured now, so the notice shows the sign-in time rather than the send time.
  const signInNotice = {
    to: user.email,
    ip: getRequestIp(request),
    device: describeDevice(request.headers.get("user-agent")),
    occurredAt: new Date().toISOString(),
  };

  sendEmailAfterResponse("Sign-in notice", () => sendNewSignInEmail(signInNotice));

  return NextResponse.json({
    message: "Signed in successfully.",
    redirectTo: "/dashboard",
  });
}
