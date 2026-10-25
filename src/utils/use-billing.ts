"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { BillingOverview } from "@/types/billing";
import { apiFetch } from "@/utils/api-fetch";
import { getCheckoutPath } from "@/utils/checkout";
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
  const router = useRouter();
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

  // Opens the in-app checkout for purchases, or sends the browser to the customer portal.
  const run = useCallback(async (action: BillingAction) => {
    setPendingAction(getActionKey(action));
    setError(null);

    if (action.type === "subscribe") {
      router.push(getCheckoutPath({ plan: action.plan }));
      return;
    }

    if (action.type === "top_up") {
      router.push(getCheckoutPath({ topUp: action.topUp }));
      return;
    }

    try {
      const response = await apiFetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flow: action.flow }),
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
  }, [router]);

  return {
    overview,
    error,
    pendingAction,
    isPending: (action: BillingAction) => pendingAction === getActionKey(action),
    reload: load,
    run,
  };
}
