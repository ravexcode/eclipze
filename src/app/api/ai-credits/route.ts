import { NextResponse } from "next/server";

import { ensureAiCreditWallet, getAiCreditUsageWindows } from "@/lib/ai-credits";
import { getCurrentUser } from "@/lib/auth";
import { isServiceOpenRouterAvailable } from "@/lib/openrouter";
import prisma from "@/lib/prisma";
import { formatPlanPrice, getSubscriptionPlan, hasUnlimitedAiCredits } from "@/utils/plans";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const [wallet, billingAccount] = await Promise.all([
    ensureAiCreditWallet(user.id),
    prisma.billingAccount.findUnique({
      where: { userId: user.id },
      select: { stripeSubscriptionId: true, currentPeriodEnd: true },
    }),
  ]);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Stripe subscriptions reset at the end of their billing period; other plans on calendar months.
  const monthlyResetAt = billingAccount?.stripeSubscriptionId && billingAccount.currentPeriodEnd
    ? billingAccount.currentPeriodEnd
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // These reads run after the wallet exists, so a first visit also lists the initial grant.
  // They do not depend on each other, so they run in parallel.
  const [entries, monthlySpend, usageWindows] = await Promise.all([
    prisma.aiCreditLedgerEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        deltaCredits: true,
        amountUsd: true,
        createdAt: true,
      },
    }),
    prisma.aiCreditLedgerEntry.aggregate({
      where: {
        userId: user.id,
        type: "SPEND",
        createdAt: { gte: monthStart },
      },
      _sum: { deltaCredits: true },
    }),
    getAiCreditUsageWindows({
      userId: user.id,
      plan: user.plan,
      reservedCredits: wallet.reservedCredits,
    }),
  ]);
  const monthlyUsedCredits = Math.abs(monthlySpend._sum.deltaCredits ?? 0) + wallet.reservedCredits;

  const plan = getSubscriptionPlan(user.plan);

  return NextResponse.json({
    planName: plan.name,
    planPrice: formatPlanPrice(plan),
    unlimitedCredits: hasUnlimitedAiCredits(user.plan),
    balance: wallet.balance,
    reservedCredits: wallet.reservedCredits,
    topUpCredits: wallet.topUpCredits,
    availableCredits: Math.max(0, wallet.balance - wallet.reservedCredits),
    monthlyAllowance: user.plan === "FREE" ? 0 : wallet.monthlyAllowance,
    monthlyUsedCredits,
    monthlyResetAt: monthlyResetAt.toISOString(),
    usageWindows,
    serviceOpenRouterAvailable: isServiceOpenRouterAvailable(),
    entries: entries.map(entry => ({
      ...entry,
      amountUsd: entry.amountUsd?.toString() ?? null,
      createdAt: entry.createdAt.toISOString(),
    })),
  }, { headers: PRIVATE_NO_STORE_HEADERS });
}
