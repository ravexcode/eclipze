import type { PlanKey } from "@/constants/plans";
import type { UserPlan } from "@/types/user";

// Minimal Stripe object shapes. Only the fields Eclipze reads are listed.

export type StripeParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | StripeParamValue[]
  | { [key: string]: StripeParamValue };

export type StripeParams = Record<string, StripeParamValue>;

export type StripeMetadata = Record<string, string>;

export type StripeCustomer = {
  id: string;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  client_secret: string | null;
  mode: "payment" | "setup" | "subscription";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  metadata: StripeMetadata | null;
};

export type StripeSubscriptionItem = {
  price: {
    id: string;
  };
  current_period_end?: number;
};

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  // Present on API versions before 2025-03-31.basil.
  current_period_end?: number;
  items: {
    data: StripeSubscriptionItem[];
  };
  metadata: StripeMetadata | null;
};

export type StripeInvoice = {
  id: string;
  billing_reason: string | null;
  // Present on API versions before 2025-03-31.basil.
  subscription?: string | null;
  parent?: {
    subscription_details?: {
      subscription?: string | null;
    } | null;
  } | null;
};

export type StripeBillingPortalSession = {
  url: string;
};

export type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

export type StripeErrorPayload = {
  error?: {
    message?: string;
    type?: string;
  };
};

// Shape returned by GET /api/billing.

export type BillingPlanOption = {
  key: PlanKey;
  plan: UserPlan;
  name: string;
  description: string;
  price: string;
  features: string[];
  availability: "available" | "coming_soon";
  isCurrent: boolean;
};

export type BillingTopUpOption = {
  key: string;
  price: string;
  credits: number;
};

// Shape returned by POST /api/billing/checkout.

export type BillingCheckoutSummary = {
  kind: "subscription" | "top_up";
  title: string;
  description: string;
  features: string[];
};

export type BillingCheckoutSession = {
  clientSecret: string;
  publishableKey: string;
  summary: BillingCheckoutSummary;
};

export type BillingOverview = {
  configured: boolean;
  plan: UserPlan;
  planName: string;
  planPrice: string;
  isInternalPlan: boolean;
  hasCustomer: boolean;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  availableCredits: number;
  topUpCredits: number;
  unlimitedCredits: boolean;
  canTopUp: boolean;
  plans: BillingPlanOption[];
  topUps: BillingTopUpOption[];
};
