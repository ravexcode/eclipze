"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CurrentPlan from "@/components/billing/current-plan";
import PlanCard from "@/components/billing/plan-card";
import TopUps from "@/components/billing/top-ups";
import { BILLING_CHECKOUT_MESSAGES, BILLING_CHECKOUT_RELOAD_DELAYS_MS } from "@/constants/billing";
import { getPlanCardAction } from "@/utils/billing";
import { useBilling } from "@/utils/use-billing";

export default function BillingWorkspace() {
  const router = useRouter();
  const billing = useBilling();
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const { overview, reload } = billing;

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("checkout");

    if (result !== "success" && result !== "cancelled") {
      return;
    }

    const timers = [
      window.setTimeout(() => {
        setCheckoutMessage(BILLING_CHECKOUT_MESSAGES[result]);
        router.replace("/billing");
      }, 0),
    ];

    if (result === "success") {
      BILLING_CHECKOUT_RELOAD_DELAYS_MS.forEach(delay => {
        timers.push(window.setTimeout(() => {
          void reload();
        }, delay));
      });
    }

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [reload, router]);

  return (
    <section className="flex min-h-0 flex-1 flex-col px-5 pb-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-250 flex-col gap-8 pt-6">
        {checkoutMessage ? (
          <p
            role="status"
            className="rounded-md border border-background-focus bg-background-card px-3 py-2.5 text-xs text-foreground">
            {checkoutMessage}
          </p>
        ) : null}

        {billing.error ? (
          <p
            role="alert"
            className="text-xs text-alert-red">
            {billing.error}
          </p>
        ) : null}

        {!overview ? (
          billing.error ? null : (
            <p
              role="status"
              className="text-xs text-foreground-off">
              Loading billing…
            </p>
          )
        ) : (
          <>
            {!overview.configured ? (
              <p className="text-xs text-foreground-off">
                Payments are not configured on this server yet.
              </p>
            ) : null}

            <CurrentPlan
              overview={overview}
              isPortalPending={billing.isPending({ type: "portal", flow: "manage" })}
              onManage={() => void billing.run({ type: "portal", flow: "manage" })} />

            <section
              aria-labelledby="plans-title"
              className="flex flex-col gap-2">
              <header className="flex flex-col gap-1">
                <h2
                  id="plans-title"
                  className="text-xs font-medium text-foreground">
                  Plans
                </h2>
                <p className="text-xs text-foreground-off">
                  Prices are in US dollars and include taxes. Upgrades apply right away with a prorated charge; downgrades start at your next billing period.
                </p>
              </header>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {overview.plans.map(option => {
                  const action = getPlanCardAction(overview, option);

                  return (
                    <PlanCard
                      key={option.key}
                      option={option}
                      action={action}
                      isPending={action.action !== null && billing.isPending(action.action)}
                      onSelect={() => {
                        if (action.action) {
                          void billing.run(action.action);
                        }
                      }} />
                  );
                })}
              </div>
            </section>

            {overview.canTopUp && overview.configured ? (
              <TopUps
                options={overview.topUps}
                pendingKey={billing.pendingAction?.startsWith("top_up:")
                  ? billing.pendingAction.slice("top_up:".length)
                  : null}
                onSelect={topUp => void billing.run({ type: "top_up", topUp })} />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
