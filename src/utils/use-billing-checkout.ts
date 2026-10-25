"use client";

import { useEffect, useRef, useState } from "react";

import { CHECKOUT_MESSAGES } from "@/constants/checkout";
import type { BillingCheckoutSession } from "@/types/billing";
import { apiFetch } from "@/utils/api-fetch";
import { readCheckoutSelection } from "@/utils/checkout";
import { errorMessage, readJson } from "@/utils/json-payload";

// Creates the Checkout Session for the plan or top-up named in the page URL.
export function useBillingCheckout() {
  const [session, setSession] = useState<BillingCheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Each visit creates one session, even when development mode runs effects twice.
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    const start = async () => {
      const selection = readCheckoutSelection(window.location.search);

      if (!selection) {
        setError(CHECKOUT_MESSAGES.missingSelection);
        return;
      }

      try {
        const response = await apiFetch("/api/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(selection),
        }, { invalidatePrivateCache: false });
        const payload = await readJson(response) as BillingCheckoutSession | null;

        if (!response.ok || !payload?.clientSecret) {
          throw new Error(errorMessage(payload, CHECKOUT_MESSAGES.loadFailed));
        }

        setSession(payload);
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : CHECKOUT_MESSAGES.loadFailed);
      }
    };

    void start();
  }, []);

  return {
    session,
    error,
  };
}
