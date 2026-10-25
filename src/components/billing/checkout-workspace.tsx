"use client";

import { useMemo } from "react";
import { CheckoutElementsProvider } from "@stripe/react-stripe-js/checkout";
import { IconArrowLeft } from "@tabler/icons-react";

import CheckoutForm from "@/components/billing/checkout-form";
import Button from "@/components/ui/button";
import { CHECKOUT_FONTS } from "@/constants/checkout";
import { getCheckoutAppearance, getStripeClient } from "@/utils/checkout";
import { useBillingCheckout } from "@/utils/use-billing-checkout";

export default function CheckoutWorkspace() {
  const { session, error } = useBillingCheckout();

  const providerOptions = useMemo(() => {
    if (!session) {
      return null;
    }

    return {
      clientSecret: session.clientSecret,
      elementsOptions: {
        appearance: getCheckoutAppearance(),
        fonts: CHECKOUT_FONTS,
      },
    };
  }, [session]);

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-250 flex-col gap-6 pt-6">
        <Button
          href="/billing"
          variant="ghost"
          className="w-max gap-1.5 px-2">
          <IconArrowLeft
            size={14}
            strokeWidth={1.8}
            aria-hidden="true" />
          Back to billing
        </Button>

        {error ? (
          <p
            role="alert"
            className="text-xs text-alert-red">
            {error}
          </p>
        ) : null}

        {!session && !error ? (
          <p
            role="status"
            className="text-xs text-foreground-off">
            Preparing checkout…
          </p>
        ) : null}

        {session && providerOptions ? (
          <CheckoutElementsProvider
            stripe={getStripeClient(session.publishableKey)}
            options={providerOptions}>
            <CheckoutForm summary={session.summary} />
          </CheckoutElementsProvider>
        ) : null}
      </div>
    </section>
  );
}
