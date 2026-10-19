import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { STRIPE_HANDLED_EVENT_TYPES } from "@/constants/billing";
import { handleStripeEvent } from "@/lib/billing";
import prisma from "@/lib/prisma";
import { verifyStripeSignature } from "@/lib/stripe";
import type { StripeEvent } from "@/types/billing";

// Stripe calls this endpoint directly, so it authenticates with the webhook signature
// instead of a user session.
export async function POST(request: Request) {
  const payload = await request.text();

  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ message: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;

  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  if (!STRIPE_HANDLED_EVENT_TYPES.includes(event.type)) {
    return NextResponse.json({ message: "Ignored." });
  }

  const alreadyProcessed = await prisma.stripeWebhookEvent.findUnique({
    where: { id: event.id },
    select: { id: true },
  });

  if (alreadyProcessed) {
    return NextResponse.json({ message: "Already processed." });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    // A non-2xx response makes Stripe retry the event later.
    console.error("Stripe webhook failed", {
      eventId: event.id,
      type: event.type,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ message: "Webhook processing failed." }, { status: 500 });
  }

  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
      },
    });
  } catch (error) {
    // A concurrent delivery already recorded this event; its effects are idempotent.
    const isDuplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

    if (!isDuplicate) {
      throw error;
    }
  }

  return NextResponse.json({ message: "Processed." });
}
