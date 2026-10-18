"use client";

// Next Setup
import { useRouter } from "next/navigation";

// Components imports
import ErdWorkspace from "@/components/erd/erd-workspace";
import DashLayout from "@/components/layouts/dash";

export default function ERDPage() {
  const router = useRouter();

  return (
    <DashLayout
      current="erd"
      router={router}>
      <ErdWorkspace />
    </DashLayout>
  );
}
