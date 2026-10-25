export const STRIPE_API_URL = "https://api.stripe.com/v1";

// Pinned so request and response shapes do not change with the account default.
// From this version on, billing period dates live on subscription items.
export const STRIPE_API_VERSION = "2025-03-31.basil";

// Checkout Sessions for the in-app checkout must match the release train of Stripe.js
// (@stripe/stripe-js 10 runs on endive), which also names the UI mode "elements".
export const STRIPE_CHECKOUT_API_VERSION = "2026-09-30.endive";

export const STRIPE_REQUEST_TIMEOUT_MS = 15_000;

// Maximum age of a webhook signature timestamp, as recommended by Stripe.
export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

// Statuses that keep paid features. past_due keeps access while Stripe retries the payment.
export const STRIPE_ENTITLED_STATUSES = ["active", "trialing", "past_due"];

// Invoices that start a billing period or change the plan, and so reset monthly credits.
export const STRIPE_CREDIT_RESET_BILLING_REASONS = [
  "subscription_create",
  "subscription_cycle",
  "subscription_update",
];

export const STRIPE_HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
];

export type AiCreditTopUp = {
  key: string;
  // USD cents, taxes included, like plan prices.
  priceCents: number;
  credits: number;
};

// Top-ups sell credits at face value: 1,000 credits = 1 USD.
export const AI_CREDIT_TOP_UPS: AiCreditTopUp[] = [
  {
    key: "credits_5",
    priceCents: 500,
    credits: 5_000,
  },
  {
    key: "credits_10",
    priceCents: 1_000,
    credits: 10_000,
  },
  {
    key: "credits_25",
    priceCents: 2_500,
    credits: 25_000,
  },
];

export const BILLING_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment past due",
  unpaid: "Unpaid",
  canceled: "Canceled",
  incomplete: "Payment pending",
  incomplete_expired: "Payment expired",
  paused: "Paused",
};

export const BILLING_CHECKOUT_MESSAGES = {
  success: "Payment received. Your plan and credits update in a few seconds.",
  cancelled: "Checkout was cancelled. You were not charged.",
} as const;

// Webhooks can land a few seconds after Stripe redirects back, so the overview reloads after these delays.
export const BILLING_CHECKOUT_RELOAD_DELAYS_MS = [2_000, 6_000];

export const BILLING_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const BILLING_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};
