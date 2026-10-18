// Prices are in USD cents and include taxes, matching Stripe's minor-unit amounts.
// Credits use the AI credit unit: 1,000 credits = 1 USD.

export type PlanKey = "free" | "plus" | "max" | "team" | "insider" | "developer";

export type PlanModelTier = "standard" | "advanced";

export type SubscriptionPlan = {
  key: PlanKey;
  name: string;
  description: string;
  priceCents: number;
  billing: "free" | "monthly" | "monthly_per_seat" | "internal";
  minimumSeats: number;
  // null means unlimited AI credits: no balance, reservation, or usage window applies.
  monthlyCredits: number | null;
  creditsScope: "user" | "team_pool";
  modelTier: PlanModelTier;
  // Rolling usage limits in credits. null means no rolling windows: Free uses a lifetime
  // total that never resets, and unlimited plans have no usage limits.
  usageWindows: {
    fiveHour: number;
    weekly: number;
  } | null;
  // null means unlimited.
  limits: {
    projects: number | null;
    monthlyMails: number | null;
  };
  stripePriceEnv: string | null;
  features: string[];
};

export const SUBSCRIPTION_PLANS = [
  {
    key: "free",
    name: "Free",
    description: "Try Eclipze with a one-time AI allowance.",
    priceCents: 0,
    billing: "free",
    minimumSeats: 1,
    monthlyCredits: 300,
    creditsScope: "user",
    modelTier: "standard",
    usageWindows: null,
    limits: {
      projects: 1,
      monthlyMails: 25,
    },
    stripePriceEnv: null,
    features: [
      "1 project, plus issues and messages",
      "25 messages per month",
      "Bring your own AI provider keys",
      "$0.30 in AI credits in total, with no monthly reset",
    ],
  },
  {
    key: "plus",
    name: "Plus",
    description: "More AI credits and higher limits for individual work.",
    priceCents: 500,
    billing: "monthly",
    minimumSeats: 1,
    monthlyCredits: 2_000,
    creditsScope: "user",
    modelTier: "standard",
    usageWindows: {
      fiveHour: 100,
      weekly: 500,
    },
    limits: {
      projects: 5,
      monthlyMails: 300,
    },
    stripePriceEnv: "STRIPE_PRICE_PLUS",
    features: [
      "Everything in Free",
      "Up to 5 projects",
      "300 messages per month",
      "$2 in monthly AI credits",
      "Higher 5-hour and weekly usage limits",
      "Credit top-ups",
    ],
  },
  {
    key: "max",
    name: "Max",
    description: "Advanced models and the highest individual limits.",
    priceCents: 1_200,
    billing: "monthly",
    minimumSeats: 1,
    monthlyCredits: 5_000,
    creditsScope: "user",
    modelTier: "advanced",
    usageWindows: {
      fiveHour: 250,
      weekly: 1_250,
    },
    limits: {
      projects: null,
      monthlyMails: 1_000,
    },
    stripePriceEnv: "STRIPE_PRICE_MAX",
    features: [
      "Everything in Plus",
      "Unlimited projects",
      "1,000 messages per month",
      "$5 in monthly AI credits",
      "Access to advanced models",
      "Highest individual usage limits",
    ],
  },
  {
    key: "team",
    name: "Enterprise",
    description: "Full access for teams, with shared credits and central billing.",
    priceCents: 1_500,
    billing: "monthly_per_seat",
    minimumSeats: 5,
    monthlyCredits: 5_000,
    creditsScope: "team_pool",
    modelTier: "advanced",
    usageWindows: {
      fiveHour: 250,
      weekly: 1_250,
    },
    limits: {
      projects: null,
      monthlyMails: 1_000,
    },
    stripePriceEnv: "STRIPE_PRICE_TEAM",
    features: [
      "Everything in Max for every member",
      "$5 in monthly AI credits per seat, shared by the team",
      "Member management and central billing",
      "Minimum of 5 seats",
    ],
  },
] as const satisfies SubscriptionPlan[];

// Internal plans are never offered for sale. They are assigned only directly in the database.
export const INTERNAL_PLANS = [
  {
    key: "insider",
    name: "Insider",
    description: "Full access for Eclipze insiders.",
    priceCents: 0,
    billing: "internal",
    minimumSeats: 1,
    monthlyCredits: null,
    creditsScope: "user",
    modelTier: "advanced",
    usageWindows: null,
    limits: {
      projects: null,
      monthlyMails: null,
    },
    stripePriceEnv: null,
    features: [
      "Everything in Max",
      "Unlimited projects and messages",
      "Unlimited AI credits",
    ],
  },
  {
    key: "developer",
    name: "Developer",
    description: "Full access for the Eclipze development team.",
    priceCents: 0,
    billing: "internal",
    minimumSeats: 1,
    monthlyCredits: null,
    creditsScope: "user",
    modelTier: "advanced",
    usageWindows: null,
    limits: {
      projects: null,
      monthlyMails: null,
    },
    stripePriceEnv: null,
    features: [
      "Everything in Max",
      "Unlimited projects and messages",
      "Unlimited AI credits",
    ],
  },
] as const satisfies SubscriptionPlan[];

export const ALL_PLANS = [...SUBSCRIPTION_PLANS, ...INTERNAL_PLANS];

export const PLAN_CREDIT_RULES = {
  // Monthly plan credits expire at the end of each billing period.
  monthlyCreditsRollOver: false,
  // Changing plans replaces the remaining monthly credits with the new plan's allowance.
  monthlyCreditsResetOnPlanChange: true,
  // Purchased top-up credits are kept until they are used.
  topUpCreditsExpire: false,
  creditsRefundable: false,
  creditsTransferable: false,
};
