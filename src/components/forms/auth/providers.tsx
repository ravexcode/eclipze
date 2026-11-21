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
      className="flex w-full flex-col gap-3">
      <div
        className="flex w-full items-center gap-2 text-xs text-foreground-off"
        aria-hidden="true">
        <span className="h-px flex-1 bg-foreground-off/60" />
        OR
        <span className="h-px flex-1 bg-foreground-off/60" />
      </div>

      <div
        className="flex w-full flex-col gap-2">
        {
          PROVIDERS.map(({ href, label, Icon }) => (
            // Plain anchors: these routes redirect to the provider, so no client routing.
            <a
              key={href}
              href={href}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-full border border-background-focus bg-background-card text-xs text-foreground transition-colors duration-200 hover:bg-background-focus focus-visible:ring-1 focus-visible:ring-brand">
              <Icon
                size={15}
                stroke={1.75} />
              {label}
            </a>
          ))
        }
      </div>
    </div>
  );
}
