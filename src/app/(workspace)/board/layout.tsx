import { requireDeveloperUser } from "@/lib/auth";

export default async function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDeveloperUser();

  return children;
}
