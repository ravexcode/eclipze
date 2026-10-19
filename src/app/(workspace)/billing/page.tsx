"use client";

import { useRouter } from "next/navigation";

import BillingWorkspace from "@/components/billing/workspace";
import DashLayout from "@/components/layouts/dash";
import Heading from "@/components/ui/heading";

export default function BillingPage() {
  const router = useRouter();

  return (
    <DashLayout
      current="billing"
      router={router}>
      <main
        className="flex w-full min-w-0 flex-col">
        <Heading label="Billing" />
        <BillingWorkspace />
      </main>
    </DashLayout>
  );
}
