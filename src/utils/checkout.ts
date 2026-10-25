import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";

import { CHECKOUT_BORDER_RADIUS, CHECKOUT_FONT_FAMILY } from "@/constants/checkout";

export type CheckoutSelection = { plan: string } | { topUp: string };

const stripeClients = new Map<string, Promise<Stripe | null>>();

// Stripe.js must load once per page, so instances are shared by publishable key.
export function getStripeClient(publishableKey: string) {
  let client = stripeClients.get(publishableKey);

  if (!client) {
    client = loadStripe(publishableKey);
    stripeClients.set(publishableKey, client);
  }

  return client;
}

export function getCheckoutPath(selection: CheckoutSelection) {
  const params = "plan" in selection
    ? new URLSearchParams({ plan: selection.plan.toLowerCase() })
    : new URLSearchParams({ topUp: selection.topUp });

  return `/billing/checkout?${params.toString()}`;
}

export function readCheckoutSelection(search: string): CheckoutSelection | null {
  const params = new URLSearchParams(search);
  const plan = params.get("plan");
  const topUp = params.get("topUp");

  if (plan) {
    return { plan };
  }

  if (topUp) {
    return { topUp };
  }

  return null;
}

// Elements cannot read the app's CSS variables from inside their iframes, so the theme
// tokens are resolved here and passed through the Appearance API.
export function getCheckoutAppearance(): Appearance {
  const styles = getComputedStyle(document.documentElement);

  const token = (name: string) => {
    return styles.getPropertyValue(`--color-${name}`).trim();
  };

  return {
    theme: "night",
    variables: {
      colorPrimary: token("accent"),
      colorBackground: token("background-card"),
      colorText: token("foreground"),
      colorTextSecondary: token("foreground-off"),
      colorTextPlaceholder: token("foreground-off"),
      colorDanger: token("alert-red"),
      fontFamily: CHECKOUT_FONT_FAMILY,
      fontSizeBase: "14px",
      borderRadius: CHECKOUT_BORDER_RADIUS,
    },
    rules: {
      ".Input": {
        backgroundColor: token("background"),
        border: "1px solid transparent",
        boxShadow: "none",
      },
      ".Input:focus": {
        borderColor: token("accent"),
        boxShadow: "none",
      },
      ".Tab": {
        backgroundColor: token("background"),
        border: `1px solid ${token("background-focus")}`,
        boxShadow: "none",
      },
      ".Tab:hover": {
        backgroundColor: token("background-focus"),
      },
      ".Tab--selected": {
        borderColor: token("accent"),
        boxShadow: "none",
      },
      ".Label": {
        color: token("foreground-off"),
        fontSize: "12px",
      },
    },
  };
}
