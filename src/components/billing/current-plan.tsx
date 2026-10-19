import { IconCreditCard } from "@tabler/icons-react";

import SettingsRow from "@/components/settings/settings-row";
import Button from "@/components/ui/button";
import type { BillingOverview } from "@/types/billing";
import { describeBillingPeriod, formatCreditsAsUsd, getBillingStatusLabel } from "@/utils/billing";

export default function CurrentPlan(props: {
  overview: BillingOverview;
  isPortalPending: boolean;
  onManage(): void;
}) {
  const { overview } = props;
  const statusLabel = getBillingStatusLabel(overview.subscriptionStatus);
  const periodLabel = describeBillingPeriod(overview);
  const isPastDue = overview.subscriptionStatus === "past_due";

  const planDetail = [
    overview.planPrice,
    overview.hasSubscription ? statusLabel : null,
    overview.hasSubscription ? periodLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-labelledby="current-plan-title"
      className="flex flex-col gap-2">
      <h2
        id="current-plan-title"
        className="text-xs font-medium text-foreground">
        Current plan
      </h2>

      <SettingsRow
        title={`${overview.planName} plan`}
        detail={planDetail}
        leading={<IconCreditCard size={16} strokeWidth={1.7} />}
        action={overview.hasCustomer && overview.configured ? (
          <Button
            type="button"
            variant="secondary"
            disabled={props.isPortalPending}
            onClick={props.onManage}>
            {props.isPortalPending ? "Opening…" : "Manage billing"}
          </Button>
        ) : null} />

      <SettingsRow
        title="Credits available"
        detail={overview.unlimitedCredits
          ? "Unlimited"
          : overview.topUpCredits > 0
            ? `${formatCreditsAsUsd(overview.availableCredits)}, including ${formatCreditsAsUsd(overview.topUpCredits)} in top-ups`
            : formatCreditsAsUsd(overview.availableCredits)} />

      {isPastDue ? (
        <p
          role="alert"
          className="text-xs text-alert-red">
          Your last payment failed. Update your payment method from Manage billing to keep your paid features.
        </p>
      ) : null}
    </section>
  );
}
