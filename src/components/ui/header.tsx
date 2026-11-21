"use client";

import Image from "next/image";
import Link from "next/link";
import Button from "./button";

type CtaValues = {
  link: string;
  label: string;
};

const SIGNED_OUT_CTA: CtaValues = {
  link: "/auth",
  label: "Sign in",
};

const SIGNED_IN_CTA: CtaValues = {
  link: "/dashboard",
  label: "Dashboard",
};

// These sections are not built yet, so they all land on the placeholder page.
const NAV_LINKS = [
  { href: "/working-on-it", label: "Product" },
  { href: "/working-on-it", label: "Plans" },
  { href: "/working-on-it", label: "About us" },
];

export default function Header({ hasToken = false }: { hasToken?: boolean }) {
  const cta = hasToken ? SIGNED_IN_CTA : SIGNED_OUT_CTA;

  return (
    <header
      className="fixed inset-x-0 top-0 z-100 grid w-full grid-cols-[1fr_auto_1fr] items-center px-5 py-3 backdrop-blur-sm backdrop-brightness-60 animate-fade-in-down duration-200 sm:px-9">
      <Link
        href="/"
        aria-label="Eclipze home"
        className="justify-self-start">
        <Image
          src="/logo.svg"
          alt="Eclipze Logo"
          width={25}
          height={25}
          loading="eager"
        />
      </Link>

      <nav
        aria-label="Main"
        className="hidden items-center gap-6 sm:flex">
        {
          NAV_LINKS.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="px-2 font-heading text-[15px] font-medium tracking-wide text-foreground-off transition-colors duration-200 hover:text-foreground">
              {label}
            </Link>
          ))
        }
      </nav>

      <Button
        variant="brand"
        href={cta.link}
        className="col-start-3 justify-self-end w-24 h-8 text-sm! font-normal rounded-lg!">
        {cta.label}
      </Button>
    </header>
  )
}
