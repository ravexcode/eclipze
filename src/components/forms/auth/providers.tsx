import {
  IconBrandGithub,
  IconBrandGoogleFilled,
} from "@tabler/icons-react";

const PROVIDERS = [
  { href: "/api/auth/google", label: "Continue with Google", Icon: IconBrandGoogleFilled },
  { href: "/api/auth/github", label: "Continue with GitHub", Icon: IconBrandGithub },
] as const;

// "OR" separator followed by the OAuth providers, stacked in a column.
export default function AuthProviders() {
  return (
    <div
      className="flex w-full flex-col gap-4">
      <div
        className="flex w-full items-center gap-3 text-[13px] text-label-secondary"
        aria-hidden="true">
        <span className="h-px flex-1 bg-foreground-off/60" />
        OR
        <span className="h-px flex-1 bg-foreground-off/60" />
      </div>

      <div
        className="flex w-full flex-col gap-3">
        {
          PROVIDERS.map(({ href, label, Icon }) => (
            // Plain anchors: these routes redirect to the provider, so no client routing.
            <a
              key={href}
              href={href}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-background-focus bg-background-card text-base font-medium text-foreground transition-colors duration-200 hover:bg-background-focus focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent">
              <Icon
                size={18}
                stroke={1.75} />
              {label}
            </a>
          ))
        }
      </div>
    </div>
  );
}
