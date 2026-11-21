import { requireDeveloperUser } from "@/lib/auth";

export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDeveloperUser();

  return children;
}
