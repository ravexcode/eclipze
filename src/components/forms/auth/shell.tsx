import Link from "next/link";

import { IconArrowLeft } from "@tabler/icons-react";

interface Props {
  title: string;
  description?: React.ReactNode;
  backHref?: string;
  children?: React.ReactNode;
}

// Shared frame for every /auth page: "Go back" link, heading and content column.
export default function AuthShell({ title, description, backHref = "/", children }: Props) {
  return (
    <div
      className="relative flex min-h-dvh w-full items-center justify-center px-5 pt-20 pb-16">
      <Link
        className="absolute left-2 top-2 flex min-h-11 items-center gap-1.5 rounded-full px-3 font-heading text-base text-foreground transition-colors duration-200 hover:text-foreground-off focus-visible:ring-1 focus-visible:ring-brand"
        href={backHref}>
        <IconArrowLeft
          size={18} />
        Go back
      </Link>

      <div
        className="flex w-full max-w-md flex-col items-center gap-6">
        <div
          className="flex w-full flex-col items-center gap-3 text-center">
          <h1
            className="font-base text-3xl font-semibold tracking-tight text-white text-balance sm:text-4xl">
            {title}
          </h1>
          {
            description &&
            <p
              className="max-w-90 text-[15px] leading-6 text-label-secondary">
              {description}
            </p>
          }
        </div>

        {children}
      </div>
    </div>
  );
}
