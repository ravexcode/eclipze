import Link from "next/link";

import MarketingLayout from "@/components/layouts/marketing";
import { getCurrentSession } from "@/lib/auth";

export const metadata = {
  title: "Working on it...",
};

export default async function WorkingOnItPage() {
  const hasToken = Boolean(await getCurrentSession());

  return (
    <MarketingLayout hasToken={hasToken}>
      <section
        className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-32 text-center animate-fade-in-up">
        <h1
          className="font-heading text-3xl font-bold tracking-[-0.01em] sm:text-5xl">
          Working on it...
        </h1>
        <p
          className="max-w-100 font-heading text-sm italic text-foreground-off">
          This section is still being built. Check back soon.
        </p>
        <Link
          href="/"
          className="mt-3 text-xs text-foreground-off underline transition-colors duration-300 hover:text-foreground">
          Back to home
        </Link>
      </section>
    </MarketingLayout>
  );
}
