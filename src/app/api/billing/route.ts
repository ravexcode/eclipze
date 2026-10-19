import { NextResponse } from "next/server";

import { BILLING_PRIVATE_HEADERS } from "@/constants/billing";
import { getCurrentUser } from "@/lib/auth";
import { getBillingOverview } from "@/lib/billing";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: BILLING_PRIVATE_HEADERS });
  }

  const overview = await getBillingOverview(user);

  return NextResponse.json(overview, { headers: BILLING_PRIVATE_HEADERS });
}
