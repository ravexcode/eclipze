"use client";

import { useRouter } from "next/navigation";

import CheckoutWorkspace from "@/components/billing/checkout-workspace";
import DashLayout from "@/components/layouts/dash";
import Heading from "@/components/ui/heading";

export default function BillingCheckoutPage() {
  const router = useRouter();

  return (
    <DashLayout
      current="billing"
      router={router}>
      <main
        className="flex w-full min-w-0 flex-col">
        <Heading label="Checkout" />
        <CheckoutWorkspace />
      </main>
    </DashLayout>
  );
}
