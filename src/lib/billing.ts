import "server-only";

import {
  AI_CREDIT_TOP_UPS,
  STRIPE_CHECKOUT_API_VERSION,
  STRIPE_CREDIT_RESET_BILLING_REASONS,
  STRIPE_ENTITLED_STATUSES,
} from "@/constants/billing";
import { SERVICE_AI_PAUSED } from "@/constants/openrouter";
import { SUBSCRIPTION_PLANS } from "@/constants/plans";
import { ensureAiCreditWallet, grantTopUpCredits, resetMonthlyAiCredits } from "@/lib/ai-credits";
import prisma from "@/lib/prisma";
import {
  getPlanForStripePrice,
  getStripePriceId,
  getStripePublishableKey,
  isStripeConfigured,
  StripeRequestError,
  stripeRequest,
} from "@/lib/stripe";
import type {
  BillingCheckoutSession,
  BillingCheckoutSummary,
  BillingOverview,
  StripeBillingPortalSession,
  StripeCheckoutSession,
  StripeCustomer,
  StripeEvent,
  StripeInvoice,
  StripeSubscription,
} from "@/types/billing";
import type { UserPlan } from "@/types/user";
import { formatUsdCents } from "@/utils/billing";
import { formatPlanPrice, getSubscriptionPlan, hasUnlimitedAiCredits, isInternalPlan } from "@/utils/plans";
import {
  getInvoiceSubscriptionId,
  getSubscriptionPeriodEnd,
  getSubscriptionPriceId,
} from "@/utils/stripe";

type BillingUser = {
  id: string;
  email: string;
  plan: UserPlan;
};

export class BillingError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}

function hasEntitledStatus(status: string | null) {
  return status !== null && STRIPE_ENTITLED_STATUSES.includes(status);
}

function assertCheckoutConfigured() {
  if (!isStripeConfigured()) {
    throw new BillingError("Payments are not configured on this server.", 503);
  }
}

function getCheckoutReturnUrl(origin: string) {
  return `${origin}/billing?checkout=success`;
}

// The in-app checkout page loads Stripe.js with the publishable key and mounts the
// payment form for this session with its client secret.
function toBillingCheckoutSession(
  session: StripeCheckoutSession,
  summary: BillingCheckoutSummary,
): BillingCheckoutSession {
  const publishableKey = getStripePublishableKey();

  if (!session.client_secret || !publishableKey) {
    throw new BillingError("Unable to start checkout right now.", 502);
  }

  return {
    clientSecret: session.client_secret,
    publishableKey,
    summary,
  };
}

function createStripeCustomer(user: BillingUser, idempotencyKey: string) {
  return stripeRequest<StripeCustomer>({
    method: "POST",
    path: "/customers",
    params: {
      email: user.email,
      metadata: { userId: user.id },
    },
    idempotencyKey,
  });
}

// A stored customer is unusable when it was created with another Stripe account or mode,
// such as an earlier sandbox key, or when it was deleted from the dashboard.
async function stripeCustomerExists(customerId: string) {
  try {
    const customer = await stripeRequest<StripeCustomer>({
      method: "GET",
      path: `/customers/${encodeURIComponent(customerId)}`,
    });

    return !customer.deleted;
  } catch (error) {
    if (error instanceof StripeRequestError && error.code === "resource_missing") {
      return false;
    }

    throw error;
  }
}

// Links the user to a new customer in the current Stripe account. The old subscription
// fields belonged to the unusable customer, so they are cleared with it.
async function replaceStripeCustomer(user: BillingUser, staleCustomerId: string) {
  console.warn("Replacing a Stripe customer that does not exist in the current account", {
    userId: user.id,
    staleCustomerId,
  });

  // Keyed on the stale ID so concurrent requests share one replacement customer.
  const customer = await createStripeCustomer(user, `customer:${user.id}:replaces:${staleCustomerId}`);

  return prisma.billingAccount.update({
    where: { userId: user.id },
    data: {
      stripeCustomerId: customer.id,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });
}

// Returns the user's billing account with a customer that exists in the current Stripe
// account, or null when the user has never started a checkout.
async function getVerifiedBillingAccount(user: BillingUser) {
  const account = await prisma.billingAccount.findUnique({ where: { userId: user.id } });

  if (!account) {
    return null;
  }

  if (await stripeCustomerExists(account.stripeCustomerId)) {
    return account;
  }

  return replaceStripeCustomer(user, account.stripeCustomerId);
}

async function getOrCreateBillingAccount(user: BillingUser) {
  const existingAccount = await getVerifiedBillingAccount(user);

  if (existingAccount) {
    return existingAccount;
  }

  // The idempotency key keeps concurrent first checkouts from creating two customers.
  const customer = await createStripeCustomer(user, `customer:${user.id}`);

  return prisma.billingAccount.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      stripeCustomerId: customer.id,
    },
    update: {},
  });
}

export async function createSubscriptionCheckout(input: {
  user: BillingUser;
  plan: UserPlan;
  origin: string;
}) {
  assertCheckoutConfigured();

  if (isInternalPlan(input.user.plan)) {
    throw new BillingError("Your plan is managed by the Eclipze team and cannot be changed here.", 409);
  }

  const plan = getSubscriptionPlan(input.plan);

  if (plan.billing !== "monthly" || plan.availability !== "available") {
    throw new BillingError("This plan is not available for purchase.", 400);
  }

  const priceId = getStripePriceId(input.plan);

  if (!priceId) {
    throw new BillingError("This plan is not configured for payments yet.", 503);
  }

  const account = await getOrCreateBillingAccount(input.user);

  // Plan changes on an existing subscription go through the billing portal, which shows
  // the prorated charge before the customer confirms.
  if (account.stripeSubscriptionId && hasEntitledStatus(account.subscriptionStatus)) {
    throw new BillingError("You already have a subscription. Change your plan from Manage billing.", 409);
  }

  const session = await stripeRequest<StripeCheckoutSession>({
    method: "POST",
    path: "/checkout/sessions",
    apiVersion: STRIPE_CHECKOUT_API_VERSION,
    params: {
      mode: "subscription",
      ui_mode: "elements",
      customer: account.stripeCustomerId,
      client_reference_id: input.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: getCheckoutReturnUrl(input.origin),
      allow_promotion_codes: true,
      metadata: { userId: input.user.id, kind: "subscription" },
      subscription_data: {
        metadata: { userId: input.user.id },
      },
    },
  });

  return toBillingCheckoutSession(session, {
    kind: "subscription",
    title: `${plan.name} plan`,
    description: plan.description,
    features: [...plan.features],
  });
}

export async function createTopUpCheckout(input: {
  user: BillingUser;
  topUpKey: string;
  origin: string;
}) {
  assertCheckoutConfigured();

  // Credits cannot be spent while Eclipze-funded AI is paused, so they are not sold either.
  if (SERVICE_AI_PAUSED) {
    throw new BillingError("Credit top-ups are unavailable while Eclipze-funded AI is paused.", 503);
  }

  const topUp = AI_CREDIT_TOP_UPS.find(option => option.key === input.topUpKey);

  if (!topUp) {
    throw new BillingError("Choose a valid credit top-up.", 400);
  }

  const account = await getVerifiedBillingAccount(input.user);
  const plan = getSubscriptionPlan(input.user.plan);

  // Top-ups are a paid-plan feature, and unlimited plans do not need them.
  if (plan.billing !== "monthly" || !account || !hasEntitledStatus(account.subscriptionStatus)) {
    throw new BillingError("Credit top-ups are available on paid plans.", 403);
  }

  const session = await stripeRequest<StripeCheckoutSession>({
    method: "POST",
    path: "/checkout/sessions",
    apiVersion: STRIPE_CHECKOUT_API_VERSION,
    params: {
      mode: "payment",
      ui_mode: "elements",
      customer: account.stripeCustomerId,
      client_reference_id: input.user.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: topUp.priceCents,
          product_data: {
            name: `Eclipze AI credits (${formatUsdCents(topUp.priceCents)})`,
          },
        },
      }],
      invoice_creation: { enabled: true },
      return_url: getCheckoutReturnUrl(input.origin),
      metadata: {
        userId: input.user.id,
        kind: "top_up",
        topUpKey: topUp.key,
        credits: String(topUp.credits),
      },
    },
  });

  return toBillingCheckoutSession(session, {
    kind: "top_up",
    title: "AI credit top-up",
    description: `${topUp.credits.toLocaleString("en-US")} credits added to your balance.`,
    features: [
      "Used after your monthly plan credits",
      "Never expire",
    ],
  });
}

export async function createBillingPortalSession(input: {
  user: BillingUser;
  origin: string;
  flow: "manage" | "change_plan";
}) {
  const account = await getVerifiedBillingAccount(input.user);

  if (!account) {
    throw new BillingError("You do not have billing history yet.", 404);
  }

  const canChangePlan = input.flow === "change_plan" &&
    account.stripeSubscriptionId &&
    hasEntitledStatus(account.subscriptionStatus);

  const session = await stripeRequest<StripeBillingPortalSession>({
    method: "POST",
    path: "/billing_portal/sessions",
    params: {
      customer: account.stripeCustomerId,
      return_url: `${input.origin}/billing`,
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() || undefined,
      flow_data: canChangePlan
        ? {
          type: "subscription_update",
          subscription_update: { subscription: account.stripeSubscriptionId },
        }
        : undefined,
    },
  });

  return session.url;
}

export async function getBillingOverview(user: BillingUser): Promise<BillingOverview> {
  const [account, wallet] = await Promise.all([
    prisma.billingAccount.findUnique({ where: { userId: user.id } }),
    ensureAiCreditWallet(user.id),
  ]);

  const currentPlan = getSubscriptionPlan(user.plan);
  const hasSubscription = Boolean(account?.stripeSubscriptionId) && hasEntitledStatus(account?.subscriptionStatus ?? null);

  return {
    configured: isStripeConfigured(),
    plan: user.plan,
    planName: currentPlan.name,
    planPrice: formatPlanPrice(currentPlan),
    isInternalPlan: isInternalPlan(user.plan),
    hasCustomer: Boolean(account),
    hasSubscription,
    subscriptionStatus: account?.subscriptionStatus ?? null,
    currentPeriodEnd: account?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: account?.cancelAtPeriodEnd ?? false,
    availableCredits: Math.max(0, wallet.balance - wallet.reservedCredits),
    topUpCredits: wallet.topUpCredits,
    unlimitedCredits: hasUnlimitedAiCredits(user.plan),
    canTopUp: !SERVICE_AI_PAUSED && hasSubscription && currentPlan.billing === "monthly",
    plans: SUBSCRIPTION_PLANS.map(plan => ({
      key: plan.key,
      plan: plan.key.toUpperCase() as UserPlan,
      name: plan.name,
      description: plan.description,
      price: formatPlanPrice(plan),
      features: [...plan.features],
      availability: plan.availability,
      isCurrent: plan.key === currentPlan.key,
    })),
    topUps: AI_CREDIT_TOP_UPS.map(topUp => ({
      key: topUp.key,
      price: formatUsdCents(topUp.priceCents),
      credits: topUp.credits,
    })),
  };
}

// Webhooks

async function findUserIdForCustomer(customerId: string, metadataUserId?: string) {
  const account = await prisma.billingAccount.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });

  return account?.userId ?? metadataUserId ?? null;
}

// Reads the subscription from Stripe instead of trusting the event payload, so events
// that arrive out of order still leave the latest state.
async function syncSubscription(subscriptionId: string) {
  const subscription = await stripeRequest<StripeSubscription>({
    method: "GET",
    path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  });

  const userId = await findUserIdForCustomer(subscription.customer, subscription.metadata?.userId);

  if (!userId) {
    console.error("Stripe subscription has no matching user", { subscriptionId });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, plan: true },
  });

  if (!user) {
    return null;
  }

  const isEntitled = hasEntitledStatus(subscription.status);
  const subscribedPlan = getPlanForStripePrice(getSubscriptionPriceId(subscription));

  if (isEntitled && !subscribedPlan) {
    console.error("Stripe subscription uses an unknown price", { subscriptionId });
    return null;
  }

  // Internal plans are assigned by the team and are never replaced by Stripe.
  const nextPlan: UserPlan = isInternalPlan(user.plan)
    ? user.plan
    : isEntitled && subscribedPlan ? subscribedPlan : "FREE";

  await prisma.$transaction([
    prisma.billingAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: isEntitled ? subscription.id : null,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: isEntitled ? subscription.id : null,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { plan: nextPlan },
    }),
  ]);

  // A plan change replaces the remaining monthly credits with the new plan's allowance.
  if (nextPlan !== user.plan) {
    await resetMonthlyAiCredits({
      userId: user.id,
      plan: nextPlan,
      idempotencyKey: `plan:${subscription.id}:${user.plan}:${nextPlan}:${Date.now()}`,
      reason: "plan_change",
    });
  }

  return { userId: user.id, plan: nextPlan };
}

async function handleCheckoutCompleted(session: StripeCheckoutSession) {
  if (session.mode === "subscription" && session.subscription) {
    await syncSubscription(session.subscription);
    return;
  }

  if (session.mode !== "payment" || session.metadata?.kind !== "top_up" || session.payment_status !== "paid") {
    return;
  }

  const userId = session.customer
    ? await findUserIdForCustomer(session.customer, session.metadata.userId)
    : session.metadata.userId;
  const topUp = AI_CREDIT_TOP_UPS.find(option => option.key === session.metadata?.topUpKey);

  if (!userId || !topUp) {
    console.error("Stripe top-up checkout could not be matched", { sessionId: session.id });
    return;
  }

  await grantTopUpCredits({
    userId,
    credits: topUp.credits,
    amountUsd: (session.amount_total ?? topUp.priceCents) / 100,
    idempotencyKey: `topup:${session.id}`,
    metadata: { checkoutSessionId: session.id, topUpKey: topUp.key },
  });
}

async function handleInvoicePaid(invoice: StripeInvoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId || !invoice.billing_reason || !STRIPE_CREDIT_RESET_BILLING_REASONS.includes(invoice.billing_reason)) {
    return;
  }

  const synced = await syncSubscription(subscriptionId);

  if (!synced) {
    return;
  }

  // Each paid period invoice starts a new billing period with a fresh monthly allowance.
  await resetMonthlyAiCredits({
    userId: synced.userId,
    plan: synced.plan,
    idempotencyKey: `invoice:${invoice.id}`,
    reason: invoice.billing_reason,
  });
}

export async function handleStripeEvent(event: StripeEvent) {
  const object = event.data.object;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(object as StripeCheckoutSession);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription((object as StripeSubscription).id);
      break;

    case "invoice.paid":
      await handleInvoicePaid(object as StripeInvoice);
      break;

    default:
      break;
  }
}
