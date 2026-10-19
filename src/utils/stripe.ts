import type {
  StripeInvoice,
  StripeParams,
  StripeParamValue,
  StripeSubscription,
} from "@/types/billing";

// Stripe expects form encoding with bracketed keys, such as line_items[0][price].
export function encodeStripeParams(params: StripeParams) {
  const body = new URLSearchParams();

  const append = (key: string, value: StripeParamValue) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        append(`${key}[${index}]`, item);
      });
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([childKey, childValue]) => {
        append(`${key}[${childKey}]`, childValue);
      });
      return;
    }

    body.append(key, String(value));
  };

  Object.entries(params).forEach(([key, value]) => {
    append(key, value);
  });

  return body;
}

// Parses a Stripe-Signature header: t=<timestamp>,v1=<signature>[,v1=<signature>...].
export function parseStripeSignatureHeader(header: string) {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  header.split(",").forEach(part => {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex < 1) {
      return;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (key === "t" && /^\d+$/.test(value)) {
      timestamp = Number(value);
    }

    if (key === "v1" && value) {
      signatures.push(value);
    }
  });

  return {
    timestamp,
    signatures,
  };
}

export function getInvoiceSubscriptionId(invoice: StripeInvoice) {
  return invoice.parent?.subscription_details?.subscription ?? invoice.subscription ?? null;
}

export function getSubscriptionPriceId(subscription: StripeSubscription) {
  return subscription.items.data[0]?.price.id ?? null;
}

export function getSubscriptionPeriodEnd(subscription: StripeSubscription) {
  const periodEnd = subscription.items.data[0]?.current_period_end ?? subscription.current_period_end;

  return typeof periodEnd === "number" ? new Date(periodEnd * 1_000) : null;
}
