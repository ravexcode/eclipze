import { NextResponse } from "next/server";

import { BILLING_PRIVATE_HEADERS } from "@/constants/billing";
import { getCurrentUser } from "@/lib/auth";
import { BillingError, createBillingPortalSession } from "@/lib/billing";
import { getAppOrigin } from "@/lib/google-oauth";
import { StripeRequestError } from "@/lib/stripe";
import { parseBody } from "@/lib/workspace-api";

// Opens the Stripe customer portal for payment methods, invoices, plan changes, and cancellation.
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: BILLING_PRIVATE_HEADERS });
  }

  const body = await parseBody(request);

  try {
    const url = await createBillingPortalSession({
      user,
      origin: getAppOrigin(request),
      flow: body?.flow === "change_plan" ? "change_plan" : "manage",
    });

    return NextResponse.json({ message: "Billing portal created.", url }, { headers: BILLING_PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof BillingError || error instanceof StripeRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status, headers: BILLING_PRIVATE_HEADERS });
    }

    throw error;
  }
}
