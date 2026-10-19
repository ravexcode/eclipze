"use client";

import { useCallback, useEffect, useState } from "react";

import type { BillingOverview } from "@/types/billing";
import { apiFetch } from "@/utils/api-fetch";
import { errorMessage, readJson } from "@/utils/json-payload";
import { getSessionUser, refreshSessionUser } from "@/utils/session";

export type BillingAction =
  | { type: "subscribe"; plan: string }
  | { type: "top_up"; topUp: string }
  | { type: "portal"; flow: "manage" | "change_plan" };

function getActionKey(action: BillingAction) {
  if (action.type === "subscribe") return `subscribe:${action.plan}`;
  if (action.type === "top_up") return `top_up:${action.topUp}`;
  return `portal:${action.flow}`;
}

export function useBilling() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/billing");
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(errorMessage(payload, "Unable to load billing."));
      }

      const nextOverview = payload as BillingOverview;
      setOverview(nextOverview);
      setError(null);

      // Webhooks change the plan on the server; refresh the sidebar when it no longer matches.
      const sessionUser = await getSessionUser();

      if (sessionUser && sessionUser.plan !== nextOverview.plan) {
        await refreshSessionUser();
        window.dispatchEvent(new Event("user-updated"));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load billing.");
    }
  }, []);

  useEffect(() => {
    // Deferred so state is not set synchronously inside the effect.
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  // Sends the browser to Stripe Checkout or the customer portal.
  const run = useCallback(async (action: BillingAction) => {
    const path = action.type === "portal" ? "/api/billing/portal" : "/api/billing/checkout";
    const body = action.type === "subscribe"
      ? { plan: action.plan }
      : action.type === "top_up"
        ? { topUp: action.topUp }
        : { flow: action.flow };

    setPendingAction(getActionKey(action));
    setError(null);

    try {
      const response = await apiFetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }, { invalidatePrivateCache: false });
      const payload = await readJson(response) as { url?: string } | null;

      if (!response.ok || !payload?.url) {
        throw new Error(errorMessage(payload, "Unable to open billing right now."));
      }

      window.location.assign(payload.url);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to open billing right now.");
      setPendingAction(null);
    }
  }, []);

  return {
    overview,
    error,
    pendingAction,
    isPending: (action: BillingAction) => pendingAction === getActionKey(action),
    reload: load,
    run,
  };
}
