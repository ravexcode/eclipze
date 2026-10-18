import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth";
import { canAccessErd } from "@/utils/erd";

export default async function ErdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthenticatedUser();

  // Accounts without ERD access go to billing to see the options that unlock it.
  if (!canAccessErd(user)) {
    redirect("/billing");
  }

  return children;
}
