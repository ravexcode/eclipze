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
      className="relative flex min-h-dvh w-full items-center justify-center px-5 py-16">
      <Link
        className="absolute left-4 top-4 flex items-center gap-1.5 rounded-md px-1 py-0.5 font-heading text-sm text-foreground transition-colors duration-200 hover:text-foreground-off focus-visible:ring-1 focus-visible:ring-brand"
        href={backHref}>
        <IconArrowLeft
          size={16} />
        Go back
      </Link>

      <div
        className="flex w-full max-w-md flex-col items-center gap-5">
        <div
          className="flex w-full flex-col items-center gap-3 text-center">
          <h1
            className="font-base text-3xl font-semibold tracking-tight text-white text-balance sm:text-4xl">
            {title}
          </h1>
          {
            description &&
            <p
              className="max-w-72 text-[11px] leading-5 text-foreground-off">
              {description}
            </p>
          }
        </div>

        {children}
      </div>
    </div>
  );
}
