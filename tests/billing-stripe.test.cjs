const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const WEBHOOK_SECRET = "whsec_test_secret";

// Values created inside the vm context have their own prototypes, so compare plain copies.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createProcess(env = {}) {
  return {
    env: {
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      STRIPE_PRICE_PLUS: "price_plus",
      STRIPE_PRICE_MAX: "price_max",
      ...env,
    },
  };
}

function loadStripe(env) {
  return loadTypeScript("src/lib/stripe.ts", {
    globals: { process: createProcess(env), Buffer, URLSearchParams },
  });
}

function sign(payload, timestamp = Math.floor(Date.now() / 1_000), secret = WEBHOOK_SECRET) {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

test("encodes nested Stripe params with bracketed keys and skips empty values", () => {
  const { encodeStripeParams } = loadTypeScript("src/utils/stripe.ts", {
    globals: { URLSearchParams },
  });

  const body = encodeStripeParams({
    mode: "subscription",
    line_items: [{ price: "price_plus", quantity: 1 }],
    metadata: { userId: "user_1" },
    configuration: undefined,
    flow_data: null,
  });

  assert.equal(
    body.toString(),
    "mode=subscription&line_items%5B0%5D%5Bprice%5D=price_plus&line_items%5B0%5D%5Bquantity%5D=1&metadata%5BuserId%5D=user_1",
  );
});

test("accepts a valid webhook signature", () => {
  const { verifyStripeSignature } = loadStripe();
  const payload = JSON.stringify({ id: "evt_1" });

  assert.equal(verifyStripeSignature(payload, sign(payload)), true);
});

test("rejects tampered, stale, foreign, and missing webhook signatures", () => {
  const { verifyStripeSignature } = loadStripe();
  const payload = JSON.stringify({ id: "evt_1" });
  const staleTimestamp = Math.floor(Date.now() / 1_000) - 3_600;

  assert.equal(verifyStripeSignature(`${payload} `, sign(payload)), false);
  assert.equal(verifyStripeSignature(payload, sign(payload, staleTimestamp)), false);
  assert.equal(verifyStripeSignature(payload, sign(payload, undefined, "whsec_other")), false);
  assert.equal(verifyStripeSignature(payload, null), false);
  assert.equal(verifyStripeSignature(payload, "t=abc,v1=zz"), false);
});

test("rejects every webhook when the signing secret is not configured", () => {
  const { verifyStripeSignature } = loadStripe({ STRIPE_WEBHOOK_SECRET: "" });
  const payload = JSON.stringify({ id: "evt_1" });

  assert.equal(verifyStripeSignature(payload, sign(payload)), false);
});

test("maps configured Stripe prices to plans", () => {
  const { getPlanForStripePrice, getStripePriceId } = loadStripe();

  assert.equal(getPlanForStripePrice("price_plus"), "PLUS");
  assert.equal(getPlanForStripePrice("price_max"), "MAX");
  assert.equal(getPlanForStripePrice("price_unknown"), null);
  assert.equal(getStripePriceId("MAX"), "price_max");
  assert.equal(getStripePriceId("TEAM"), null);
  assert.equal(getStripePriceId("FREE"), null);
});

test("reads subscription ids and period ends across Stripe API versions", () => {
  const { getInvoiceSubscriptionId, getSubscriptionPeriodEnd } = loadTypeScript("src/utils/stripe.ts", {
    globals: { URLSearchParams },
  });

  assert.equal(getInvoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } } }), "sub_new");
  assert.equal(getInvoiceSubscriptionId({ subscription: "sub_old" }), "sub_old");
  assert.equal(getInvoiceSubscriptionId({}), null);

  const itemPeriod = getSubscriptionPeriodEnd({ items: { data: [{ price: { id: "p" }, current_period_end: 1_800_000_000 }] } });
  const legacyPeriod = getSubscriptionPeriodEnd({ current_period_end: 1_700_000_000, items: { data: [] } });

  assert.equal(itemPeriod.getTime(), 1_800_000_000_000);
  assert.equal(legacyPeriod.getTime(), 1_700_000_000_000);
});

function makeOverview(overrides = {}) {
  const plans = ["FREE", "PLUS", "MAX", "TEAM"].map(plan => ({
    key: plan.toLowerCase(),
    plan,
    name: plan,
    description: "",
    price: "",
    features: [],
    availability: plan === "TEAM" ? "coming_soon" : "available",
    isCurrent: plan === (overrides.plan ?? "FREE"),
  }));

  return {
    configured: true,
    plan: "FREE",
    isInternalPlan: false,
    hasSubscription: false,
    cancelAtPeriodEnd: false,
    plans,
    ...overrides,
  };
}

test("plan cards start checkout without a subscription and open the portal with one", () => {
  const { getPlanCardAction } = loadTypeScript("src/utils/billing.ts");

  const freeOverview = makeOverview();
  const [free, plus, , team] = freeOverview.plans;

  assert.deepEqual(plain(getPlanCardAction(freeOverview, plus).action), { type: "subscribe", plan: "PLUS" });
  assert.equal(getPlanCardAction(freeOverview, free).label, "Current plan");
  assert.equal(getPlanCardAction(freeOverview, team).label, "Coming soon");
  assert.equal(getPlanCardAction(freeOverview, team).disabled, true);

  const plusOverview = makeOverview({ plan: "PLUS", hasSubscription: true });
  const [, , max] = plusOverview.plans;

  assert.deepEqual(plain(getPlanCardAction(plusOverview, max).action), { type: "portal", flow: "change_plan" });
  assert.equal(getPlanCardAction(plusOverview, max).label, "Upgrade to MAX");
  assert.deepEqual(plain(getPlanCardAction(plusOverview, plusOverview.plans[0]).action), { type: "portal", flow: "manage" });
});

test("plan cards are disabled for internal plans and unconfigured servers", () => {
  const { getPlanCardAction } = loadTypeScript("src/utils/billing.ts");

  const internal = makeOverview({ plan: "DEVELOPER", isInternalPlan: true });
  const unconfigured = makeOverview({ configured: false });

  assert.equal(getPlanCardAction(internal, internal.plans[1]).disabled, true);
  assert.equal(getPlanCardAction(unconfigured, unconfigured.plans[1]).label, "Unavailable");
});

function loadWebhookRoute({ processedIds = [] } = {}) {
  const handled = [];
  const recorded = [];

  const route = loadTypeScript("src/app/api/billing/webhook/route.ts", {
    globals: { process: createProcess(), Buffer, URLSearchParams },
    mocks: {
      "@/lib/billing": {
        handleStripeEvent: async event => {
          handled.push(event.id);
        },
      },
      "@/lib/prisma": {
        stripeWebhookEvent: {
          findUnique: async ({ where }) => processedIds.includes(where.id) ? { id: where.id } : null,
          create: async ({ data }) => {
            recorded.push(data.id);
            return data;
          },
        },
      },
      "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    },
  });

  return { route, handled, recorded };
}

function webhookRequest(payload, signature) {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: payload,
  });
}

test("webhook rejects requests without a valid signature", async () => {
  const { route, handled } = loadWebhookRoute();
  const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: {} } });

  const response = await route.POST(webhookRequest(payload, "t=1,v1=00"));

  assert.equal(response.status, 400);
  assert.deepEqual(handled, []);
});

test("webhook handles a signed event once and records it", async () => {
  const { route, handled, recorded } = loadWebhookRoute();
  const payload = JSON.stringify({ id: "evt_2", type: "invoice.paid", data: { object: {} } });

  const response = await route.POST(webhookRequest(payload, sign(payload)));

  assert.equal(response.status, 200);
  assert.deepEqual(handled, ["evt_2"]);
  assert.deepEqual(recorded, ["evt_2"]);
});

test("webhook skips redelivered and unhandled events", async () => {
  const { route, handled } = loadWebhookRoute({ processedIds: ["evt_3"] });
  const redelivered = JSON.stringify({ id: "evt_3", type: "invoice.paid", data: { object: {} } });
  const unhandled = JSON.stringify({ id: "evt_4", type: "charge.refunded", data: { object: {} } });

  assert.equal((await route.POST(webhookRequest(redelivered, sign(redelivered)))).status, 200);
  assert.equal((await route.POST(webhookRequest(unhandled, sign(unhandled)))).status, 200);
  assert.deepEqual(handled, []);
});
