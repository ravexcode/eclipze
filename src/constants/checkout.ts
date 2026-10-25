import type { CssFontSource } from "@stripe/stripe-js";

// Stripe Elements render inside iframes, so the app font is loaded there separately.
export const CHECKOUT_FONTS: CssFontSource[] = [
  {
    cssSrc: "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,100..1000&display=swap",
  },
];

export const CHECKOUT_FONT_FAMILY = "'Roboto Flex', sans-serif";

// Matches the rounded-md radius used by app inputs and cards.
export const CHECKOUT_BORDER_RADIUS = "6px";

export const CHECKOUT_KIND_LABELS = {
  subscription: "Subscription",
  top_up: "One-time purchase",
} as const;

export const CHECKOUT_MESSAGES = {
  missingSelection: "Choose a plan or a credit top-up from Billing first.",
  loadFailed: "Unable to start checkout right now.",
  expired: "This checkout expired. Start again from Billing.",
  complete: "This checkout is already complete.",
  confirmFailed: "Payment could not be completed. Check your details and try again.",
} as const;
