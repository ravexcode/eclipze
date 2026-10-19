"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";

import { apiFetch } from "@/utils/api-fetch";
import { readJson } from "@/utils/json-payload";
import SettingsRow from "./settings-row";
import SettingsSection from "./settings-section";

type CreditBalance = {
  planName: string;
  planPrice: string;
  unlimitedCredits: boolean;
  availableCredits: number;
  serviceOpenRouterAvailable: boolean;
};

export default function AiCreditsSection() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch("/api/ai-credits", { cache: "no-store" })
      .then(async (response) => {
        const payload = await readJson(response) as CreditBalance & { message?: string };
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.message ?? "Unable to load AI credits.");
        setBalance(payload);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load AI credits.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const billingLink = (label: string, href: string) => (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-foreground-off transition-colors hover:text-foreground">
      {label}
      <IconArrowRight size={13} strokeWidth={1.6} />
    </Link>
  );

  return (
    <SettingsSection
      title="Billing"
      description="Your plan and Eclipse-funded AI credits.">
        {balance ? (
          <SettingsRow
            title={`${balance.planName} plan`}
            detail={balance.planPrice}
            action={billingLink("View plans", "/billing")} />
        ) : null}
        {balance?.unlimitedCredits ? (
          <SettingsRow
            title="Credits available"
            detail="Unlimited" />
        ) : balance ? (
          <SettingsRow
            title="Credits available"
            detail={<>${(balance.availableCredits / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</>}
            action={billingLink("Get more", "/billing#top-ups")} />
        ) : error ? (
          <SettingsRow title="Credits available" action={<span className="text-alert-red">Unavailable</span>} />
        ) : (
          <SettingsRow title="Credits available" action={<span role="status" className="text-foreground-off">Loading...</span>} />
        )}
      {error ? <p role="alert" className="text-xs text-alert-red">{error}</p> : null}
      {balance && !balance.serviceOpenRouterAvailable ? (
        <p className="text-xs text-foreground-off">Eclipse-funded OpenRouter is not enabled on this server.</p>
      ) : null}
    </SettingsSection>
  );
}
