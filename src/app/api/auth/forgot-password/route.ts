import { NextResponse } from "next/server";

import { RATE_LIMIT_RULES } from "@/constants/rate-limit";
import prisma from "@/lib/prisma";
import {
  createVerificationCode,
  getRequestIp,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import { enforceRateLimits } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = normalizeEmail(body?.email ?? "");
  const message = "If an eligible account exists, we sent a password reset code to that email.";

  // Counted for every email, known or not, so the limit does not reveal which accounts exist.
  const rateLimitResponse = await enforceRateLimits([
    { rule: RATE_LIMIT_RULES.sendCodeByIp, subject: getRequestIp(request) },
    ...(isValidEmail(email) ? [{ rule: RATE_LIMIT_RULES.sendCodeByEmail, subject: email }] : []),
  ]);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ message }, { status: 200 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.passwordHash && user.emailVerifiedAt) {
    const verification = await createVerificationCode({ userId: user.id, purpose: "PASSWORD_RESET" });
    try {
      await sendAuthCodeEmail({ to: user.email, code: verification.code, purpose: "PASSWORD_RESET" });
    } catch {
      // Keep the response indistinguishable from an unknown account.
    }
  }

  return NextResponse.json({ message });
}
