"use client";

import { useState, type FormEvent } from "react";
import { PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import { IconLock } from "@tabler/icons-react";

import CheckoutSummary from "@/components/billing/checkout-summary";
import Button from "@/components/ui/button";
import { CHECKOUT_MESSAGES } from "@/constants/checkout";
import type { BillingCheckoutSummary } from "@/types/billing";

export default function CheckoutForm(props: {
  summary: BillingCheckoutSummary;
}) {
  const checkoutState = useCheckoutElements();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkout = checkoutState.type === "success" ? checkoutState.checkout : null;
  const sessionStatus = checkout?.status.type ?? null;
  const isSubscription = props.summary.kind === "subscription";

  const loadError = checkoutState.type === "error"
    ? checkoutState.error.message
    : sessionStatus === "expired"
      ? CHECKOUT_MESSAGES.expired
      : sessionStatus === "complete"
        ? CHECKOUT_MESSAGES.complete
        : null;

  const applyPromotionCode = async (code: string) => {
    if (!checkout) {
      return null;
    }

    const result = await checkout.applyPromotionCode(code);

    return result.type === "error" ? result.error.message : null;
  };

  const removePromotionCode = async () => {
    if (!checkout) {
      return null;
    }

    const result = await checkout.removePromotionCode();

    return result.type === "error" ? result.error.message : null;
  };

  // A successful confirmation redirects to Billing, which waits for the webhook to apply the plan.
  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!checkout) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await checkout.confirm();

    if (result.type === "error") {
      setError(result.error.message || CHECKOUT_MESSAGES.confirmFailed);
      setIsSubmitting(false);
    }
  };

  const submitLabel = isSubmitting
    ? "Processing…"
    : !checkout
      ? "Loading…"
      : isSubscription
        ? `Subscribe for ${checkout.total.total.amount}`
        : `Pay ${checkout.total.total.amount}`;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <CheckoutSummary
        summary={props.summary}
        checkout={checkout}
        onApplyPromotionCode={applyPromotionCode}
        onRemovePromotionCode={removePromotionCode} />

      <form
        aria-labelledby="checkout-payment-title"
        onSubmit={event => void confirm(event)}
        className="flex flex-col gap-4 rounded-md bg-background-card p-4">
        <header className="flex flex-col gap-1">
          <h2
            id="checkout-payment-title"
            className="text-sm font-medium text-foreground">
            Payment
          </h2>

          {checkout?.email ? (
            <p className="text-xs text-foreground-off">
              Receipts go to {checkout.email}
            </p>
          ) : null}
        </header>

        {loadError ? (
          <p
            role="alert"
            className="text-xs text-alert-red">
            {loadError}
          </p>
        ) : (
          <PaymentElement
            options={{
              layout: "tabs",
            }} />
        )}

        {error ? (
          <p
            role="alert"
            className="text-xs text-alert-red">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!checkout || !checkout.canConfirm || isSubmitting || Boolean(loadError)}
          className="h-8 w-full cursor-pointer disabled:cursor-not-allowed disabled:brightness-75">
          {submitLabel}
        </Button>

        <p className="flex items-start gap-2 text-xs text-foreground-off">
          <IconLock
            size={14}
            strokeWidth={1.8}
            aria-hidden="true"
            className="mt-px shrink-0" />
          {isSubscription
            ? "Payments are processed by Stripe. Your plan renews monthly until you cancel from Manage billing."
            : "Payments are processed by Stripe. Credits are added as soon as the payment clears."}
        </p>
      </form>
    </div>
  );
}
