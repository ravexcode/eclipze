import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  STRIPE_API_URL,
  STRIPE_API_VERSION,
  STRIPE_REQUEST_TIMEOUT_MS,
  STRIPE_WEBHOOK_TOLERANCE_SECONDS,
} from "@/constants/billing";
import { SUBSCRIPTION_PLANS } from "@/constants/plans";
import type { StripeErrorPayload, StripeParams } from "@/types/billing";
import type { UserPlan } from "@/types/user";
import { encodeStripeParams, parseStripeSignatureHeader } from "@/utils/stripe";

// Minimal Stripe REST client. Eclipze only needs a few endpoints, so it calls the API
// with fetch instead of bundling the full SDK.

export class StripeRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StripeRequestError";
    this.status = status;
  }
}

function getSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function isStripeConfigured() {
  return Boolean(getSecretKey());
}

export async function stripeRequest<T>(input: {
  method: "GET" | "POST";
  path: string;
  params?: StripeParams;
  idempotencyKey?: string;
}): Promise<T> {
  const secretKey = getSecretKey();

  if (!secretKey) {
    throw new StripeRequestError("Payments are not configured on this server.", 503);
  }

  const encodedParams = input.params ? encodeStripeParams(input.params) : null;
  const url = input.method === "GET" && encodedParams
    ? `${STRIPE_API_URL}${input.path}?${encodedParams.toString()}`
    : `${STRIPE_API_URL}${input.path}`;

  const headers = new Headers({
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
  });

  if (input.method === "POST") {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  }

  if (input.idempotencyKey) {
    headers.set("Idempotency-Key", input.idempotencyKey);
  }

  const response = await fetch(url, {
    method: input.method,
    headers,
    body: input.method === "POST" && encodedParams ? encodedParams.toString() : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS),
  });

  const payload = await response.json().catch(() => null) as (T & StripeErrorPayload) | null;

  if (!response.ok || !payload) {
    // Stripe error messages never include the secret key, but log only the type to keep logs small.
    console.error("Stripe request failed", {
      path: input.path,
      status: response.status,
      type: payload?.error?.type,
    });

    throw new StripeRequestError("The payment provider is unavailable right now. Try again in a moment.", 502);
  }

  return payload;
}

export function verifyStripeSignature(payload: string, signatureHeader: string | null) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret || !signatureHeader) {
    return false;
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);

  if (timestamp === null || signatures.length === 0) {
    return false;
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1_000) - timestamp);

  if (ageSeconds > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest();

  return signatures.some(signature => {
    const received = Buffer.from(signature, "hex");

    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export function getStripePriceId(plan: UserPlan) {
  const subscriptionPlan = SUBSCRIPTION_PLANS.find(item => item.key === plan.toLowerCase());

  if (!subscriptionPlan?.stripePriceEnv) {
    return null;
  }

  return process.env[subscriptionPlan.stripePriceEnv]?.trim() || null;
}

export function getPlanForStripePrice(priceId: string | null): UserPlan | null {
  if (!priceId) {
    return null;
  }

  const subscriptionPlan = SUBSCRIPTION_PLANS.find(item => {
    return item.stripePriceEnv !== null && process.env[item.stripePriceEnv]?.trim() === priceId;
  });

  return subscriptionPlan ? subscriptionPlan.key.toUpperCase() as UserPlan : null;
}
