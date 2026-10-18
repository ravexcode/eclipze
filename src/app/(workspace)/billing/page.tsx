"use client";

import { useRouter } from "next/navigation";

import DashLayout from "@/components/layouts/dash";
import Heading from "@/components/ui/heading";

export default function BillingPage() {
  const router = useRouter();

  return (
    <DashLayout
      current="billing"
      router={router}>
      <main
        className="w-full min-w-0">
        <Heading label="Billing" />
      </main>
    </DashLayout>
  );
}
