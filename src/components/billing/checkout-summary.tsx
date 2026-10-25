import { IconCheck } from "@tabler/icons-react";
import type { StripeCheckoutSession } from "@stripe/stripe-js";

import CheckoutPromotionCode from "@/components/billing/checkout-promotion-code";
import { CHECKOUT_KIND_LABELS } from "@/constants/checkout";
import type { BillingCheckoutSummary } from "@/types/billing";

function SummaryRow(props: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${props.emphasis ? "text-sm font-medium text-foreground" : "text-xs text-foreground-off"}`}>
      <span>
        {props.label}
      </span>
      <span>
        {props.value}
      </span>
    </div>
  );
}

export default function CheckoutSummary(props: {
  summary: BillingCheckoutSummary;
  checkout: StripeCheckoutSession | null;
  onApplyPromotionCode(code: string): Promise<string | null>;
  onRemovePromotionCode(): Promise<string | null>;
}) {
  const { summary, checkout } = props;
  const recurring = checkout?.recurring ?? null;
  const discountAmounts = checkout?.discountAmounts ?? [];

  return (
    <section
      aria-labelledby="checkout-summary-title"
      className="flex flex-col gap-4 rounded-md bg-background-card p-4">
      <header className="flex flex-col gap-1">
        <span className="text-xs text-foreground-off">
          {CHECKOUT_KIND_LABELS[summary.kind]}
        </span>

        <h2
          id="checkout-summary-title"
          className="text-sm font-medium text-foreground">
          {summary.title}
        </h2>

        <p className="text-lg font-medium text-foreground">
          {checkout ? checkout.total.total.amount : "…"}
          {recurring ? (
            <span className="text-xs font-normal text-foreground-off">
              {" "}/ {recurring.interval}
            </span>
          ) : null}
        </p>

        <p className="text-xs text-foreground-off">
          {summary.description}
        </p>
      </header>

      <ul className="flex flex-col gap-2 text-xs text-foreground-off">
        {summary.features.map(feature => (
          <li
            key={feature}
            className="flex items-start gap-2">
            <IconCheck
              size={14}
              strokeWidth={1.8}
              aria-hidden="true"
              className="mt-px shrink-0 text-foreground" />
            {feature}
          </li>
        ))}
      </ul>

      {checkout ? (
        <>
          <CheckoutPromotionCode
            appliedCodes={discountAmounts.map(discount => discount.promotionCode ?? discount.displayName)}
            onApply={props.onApplyPromotionCode}
            onRemove={props.onRemovePromotionCode} />

          <div className="flex flex-col gap-2 border-t border-background-focus pt-4">
            <SummaryRow
              label="Subtotal"
              value={checkout.total.subtotal.amount} />

            {discountAmounts.map(discount => (
              <SummaryRow
                key={discount.displayName}
                label={discount.displayName}
                value={`-${discount.amount}`} />
            ))}

            <SummaryRow
              label="Total due today"
              value={checkout.total.total.amount}
              emphasis />

            {recurring ? (
              <p className="text-xs text-foreground-off">
                Then {recurring.dueNext.total.amount} every {recurring.interval}. Taxes included.
              </p>
            ) : (
              <p className="text-xs text-foreground-off">
                Taxes included.
              </p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
