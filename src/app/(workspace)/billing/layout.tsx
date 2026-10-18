import { requireAuthenticatedUser } from "@/lib/auth";

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthenticatedUser();

  return children;
}
