import Button from "@/components/ui/button";
import type { BillingTopUpOption } from "@/types/billing";

export default function TopUps(props: {
  options: BillingTopUpOption[];
  pendingKey: string | null;
  onSelect(key: string): void;
}) {
  return (
    <section
      id="top-ups"
      aria-labelledby="top-ups-title"
      className="flex flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h2
          id="top-ups-title"
          className="text-xs font-medium text-foreground">
          Credit top-ups
        </h2>
        <p className="text-xs text-foreground-off">
          Top-up credits never expire and are used after your monthly plan credits.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        {props.options.map(option => (
          <div
            key={option.key}
            className="flex items-center justify-between gap-3 rounded-md border border-background-focus bg-background-card px-3 py-2.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">
                {option.price}
              </span>
              <span className="text-xs text-foreground-off">
                {option.credits.toLocaleString("en-US")} credits
              </span>
            </span>

            <Button
              type="button"
              variant="secondary"
              disabled={props.pendingKey !== null}
              onClick={() => props.onSelect(option.key)}>
              {props.pendingKey === option.key ? "Opening…" : "Buy"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
