# Billing with Stripe

Eclipze sells the Plus and Max plans as monthly Stripe subscriptions and sells AI credit top-ups as one-time Stripe Checkout payments. The Enterprise plan is shown as "Coming soon" until team seats, member management, and the shared credit pool exist.

The integration calls the Stripe REST API with `fetch` (`src/lib/stripe.ts`), so no Stripe SDK is installed.

## How it works

| Piece | Location |
| --- | --- |
| Plans, prices, and limits | `src/constants/plans.ts` |
| Top-up packs and Stripe constants | `src/constants/billing.ts` |
| Stripe REST client and webhook signature check | `src/lib/stripe.ts` |
| Checkout, portal, and webhook handling | `src/lib/billing.ts` |
| Monthly resets and top-up credits | `src/lib/ai-credits.ts` |
| API routes | `src/app/api/billing/**` |
| Billing page | `src/app/(workspace)/billing/page.tsx`, `src/components/billing/**` |

- **New subscriptions** use Stripe Checkout (`POST /api/billing/checkout` with `{ "plan": "PLUS" }`).
- **Plan changes, cancellation, payment methods, and invoices** use the Stripe customer portal (`POST /api/billing/portal`). The portal shows the prorated charge before the customer confirms an upgrade.
- **Top-ups** use Stripe Checkout in payment mode (`POST /api/billing/checkout` with `{ "topUp": "credits_10" }`). Only customers with an active paid subscription can buy them.
- **Webhooks** (`POST /api/billing/webhook`) update `User.plan`, the `billing_accounts` row, and AI credits. Each handler reads the subscription again from Stripe, so events that arrive out of order still leave the latest state. Handled event IDs are stored in `stripe_webhook_events`, and every credit change has a ledger idempotency key.

### Credits

- Each paid invoice that starts a billing period (`subscription_create`, `subscription_cycle`, `subscription_update`) **resets** the monthly part of the balance to the plan allowance. Monthly credits do not accumulate.
- `ai_credit_wallets.topUpCredits` is the part of the balance bought as top-ups. Spending uses monthly credits first, so top-ups survive resets and plan changes.
- When a subscription ends, the account returns to Free and keeps only its top-up credits. Free accounts cannot spend more than the Free lifetime limit, so leftover top-ups become usable again after resubscribing.
- `past_due` subscriptions keep paid features while Stripe retries the payment. `unpaid`, `canceled`, and `incomplete_expired` return the account to Free.

## Stripe setup

1. Create two products with **monthly recurring USD prices**: Plus ($5) and Max ($12). Prices include taxes, so mark them as tax inclusive if you use Stripe Tax. Copy the price IDs into `STRIPE_PRICE_PLUS` and `STRIPE_PRICE_MAX`.
2. Copy the secret key into `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint at `$APP_URL/api/billing/webhook` with these events, then copy its signing secret into `STRIPE_WEBHOOK_SECRET`:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
4. Configure the customer portal (Settings → Billing → Customer portal) to match the Terms of Service:
   - Allow customers to update payment methods and view invoice history.
   - Allow cancellation **at the end of the billing period**.
   - Allow switching between the Plus and Max prices. Set upgrades to **prorate and invoice immediately**, and schedule downgrades **at the end of the billing period**.
   - To use a non-default configuration, put its ID in `STRIPE_PORTAL_CONFIGURATION_ID`.
5. Turn on Smart Retries and failed payment emails (Settings → Billing → Subscriptions and emails).
6. Apply the database migration: `pnpm prisma migrate deploy` (or `pnpm prisma:migrate` in development).

### Local testing

```bash
stripe listen --forward-to localhost:4040/api/billing/webhook
```

Use the `whsec_…` secret that the command prints as `STRIPE_WEBHOOK_SECRET`.

## Still open

- Final top-up pack prices (currently face value: 1,000 credits = $1 USD).
- Mexican electronic invoices (CFDI). Stripe does not issue them; a provider such as Facturapi is needed if customers request them.
- Enterprise: team model, seats with a 5-seat minimum and prorating, shared credit pool.
