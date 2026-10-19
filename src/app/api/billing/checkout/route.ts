import { NextResponse } from "next/server";

import { BILLING_PRIVATE_HEADERS } from "@/constants/billing";
import { getCurrentUser } from "@/lib/auth";
import { BillingError, createSubscriptionCheckout, createTopUpCheckout } from "@/lib/billing";
import { getAppOrigin } from "@/lib/google-oauth";
import { StripeRequestError } from "@/lib/stripe";
import { parseBody } from "@/lib/workspace-api";
import type { UserPlan } from "@/types/user";

// Starts a Stripe Checkout session for a new subscription ({ plan }) or a credit top-up ({ topUp }).
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: BILLING_PRIVATE_HEADERS });
  }

  const body = await parseBody(request);
  const origin = getAppOrigin(request);

  try {
    let url: string;

    if (typeof body?.plan === "string") {
      url = await createSubscriptionCheckout({
        user,
        plan: body.plan.toUpperCase() as UserPlan,
        origin,
      });
    } else if (typeof body?.topUp === "string") {
      url = await createTopUpCheckout({
        user,
        topUpKey: body.topUp,
        origin,
      });
    } else {
      return NextResponse.json(
        { message: "Choose a plan or a credit top-up." },
        { status: 400, headers: BILLING_PRIVATE_HEADERS },
      );
    }

    return NextResponse.json({ message: "Checkout created.", url }, { headers: BILLING_PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof BillingError || error instanceof StripeRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status, headers: BILLING_PRIVATE_HEADERS });
    }

    throw error;
  }
}
