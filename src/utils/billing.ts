import { BILLING_DATE_FORMATTER, BILLING_STATUS_LABELS } from "@/constants/billing";
import type { BillingOverview, BillingPlanOption } from "@/types/billing";

export function formatUsdCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

export function formatCreditsAsUsd(credits: number) {
  return `$${(credits / 1_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} USD`;
}

export function formatBillingDate(isoDate: string | null) {
  return isoDate ? BILLING_DATE_FORMATTER.format(new Date(isoDate)) : null;
}

export function getBillingStatusLabel(status: string | null) {
  if (!status) {
    return null;
  }

  return BILLING_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

// Describes when the current subscription renews or ends, for the current plan summary.
export function describeBillingPeriod(input: {
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  const date = formatBillingDate(input.currentPeriodEnd);

  if (!date) {
    return null;
  }

  return input.cancelAtPeriodEnd
    ? `Ends on ${date}. Your account then returns to the Free plan.`
    : `Renews on ${date}.`;
}

export type PlanCardAction = {
  label: string;
  disabled: boolean;
  action: { type: "subscribe"; plan: string } | { type: "portal"; flow: "manage" | "change_plan" } | null;
};

// Decides what the button on a plan card does for the current subscription.
export function getPlanCardAction(overview: BillingOverview, option: BillingPlanOption): PlanCardAction {
  if (option.availability === "coming_soon") {
    return { label: "Coming soon", disabled: true, action: null };
  }

  if (option.isCurrent) {
    return { label: "Current plan", disabled: true, action: null };
  }

  if (overview.isInternalPlan) {
    return { label: "Included in your plan", disabled: true, action: null };
  }

  if (!overview.configured) {
    return { label: "Unavailable", disabled: true, action: null };
  }

  // Leaving a paid plan for Free means cancelling the subscription in the portal.
  if (option.plan === "FREE") {
    return overview.hasSubscription && !overview.cancelAtPeriodEnd
      ? { label: "Switch to Free", disabled: false, action: { type: "portal", flow: "manage" } }
      : { label: "Free", disabled: true, action: null };
  }

  const currentIndex = overview.plans.findIndex(plan => plan.isCurrent);
  const optionIndex = overview.plans.findIndex(plan => plan.key === option.key);
  const label = optionIndex > currentIndex ? `Upgrade to ${option.name}` : `Switch to ${option.name}`;

  return overview.hasSubscription
    ? { label, disabled: false, action: { type: "portal", flow: "change_plan" } }
    : { label, disabled: false, action: { type: "subscribe", plan: option.plan } };
}
