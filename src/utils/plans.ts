import { ALL_PLANS, SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/constants/plans";
import type { UserPlan } from "@/types/user";

export function formatPlanPrice(plan: Pick<SubscriptionPlan, "priceCents" | "billing">) {
  if (plan.billing === "free") {
    return "Free";
  }

  if (plan.billing === "internal") {
    return "Included";
  }

  const price = (plan.priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

  return plan.billing === "monthly_per_seat"
    ? `${price} / seat / month`
    : `${price} / month`;
}

export function getPlanName(plan: UserPlan) {
  return getSubscriptionPlan(plan).name;
}

export function getSubscriptionPlan(plan: UserPlan): SubscriptionPlan {
  return ALL_PLANS.find(item => item.key === plan.toLowerCase()) ?? SUBSCRIPTION_PLANS[0];
}

export function isInternalPlan(plan: UserPlan) {
  return getSubscriptionPlan(plan).billing === "internal";
}

export function hasUnlimitedAiCredits(plan: UserPlan) {
  return getSubscriptionPlan(plan).monthlyCredits === null;
}

export function getMonthStartUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
