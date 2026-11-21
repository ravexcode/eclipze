import Image from "next/image";

import { redirect } from "next/navigation";

import MarketingLayout from "@/components/layouts/marketing";
import Showcase from "@/components/marketing/showcase";
import RevealOnView from "@/components/ui/reveal-on-view";

import { getCurrentSession } from "@/lib/auth";

export default async function HomePage() {
  const hasToken = Boolean(await getCurrentSession());

  if (hasToken) redirect("/dashboard");

  return (
    <MarketingLayout hasToken={hasToken}>
      <section
        className="relative flex h-dvh min-h-120 w-full items-center justify-center overflow-hidden">
        {/* Opacity lives on the wrapper: animate-fade-in ends at opacity 1. */}
        <div
          className="absolute inset-0 opacity-80">
          <Image
            src="/marketing.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover animate-fade-in" />
        </div>

        <div
          className="relative flex max-w-300 flex-col items-center gap-1.5 px-4 text-center animate-fade-in-up">
          <h1
            className="bg-linear-to-r from-foreground-off via-foreground to-foreground bg-clip-text pb-1 font-heading text-4xl font-bold tracking-[-0.01em] text-transparent animate-blurred-fade-in sm:text-5xl md:text-[64px]">
            Build beyond limits
          </h1>
          <p
            className="max-w-135 font-heading text-lg italic tracking-[-0.01em] text-foreground sm:text-base">
            Empower your teams to move faster, execute smarter, and scale without limits.
          </p>
        </div>
      </section>

      <section
        className="mx-auto flex w-full max-w-300 items-center justify-center px-5 py-20 my-50">
        <RevealOnView
          className="w-full"
          enterThreshold={0.2}
          exitThreshold={0.2}
          animation="animate-fade-in-up">
          <Showcase />
        </RevealOnView>
      </section>
    </MarketingLayout>
  );
}
