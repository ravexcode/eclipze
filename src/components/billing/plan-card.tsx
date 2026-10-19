import { IconCheck } from "@tabler/icons-react";

import Button from "@/components/ui/button";
import type { BillingPlanOption } from "@/types/billing";
import type { PlanCardAction } from "@/utils/billing";

export default function PlanCard(props: {
  option: BillingPlanOption;
  action: PlanCardAction;
  isPending: boolean;
  onSelect(): void;
}) {
  const { option, action } = props;
  const isComingSoon = option.availability === "coming_soon";

  return (
    <article
      className={`flex flex-col gap-4 rounded-md border bg-background-card p-4 ${option.isCurrent ? "border-accent" : "border-background-focus"}`}>
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">
            {option.name}
          </h3>

          {option.isCurrent ? (
            <span className="rounded-sm bg-accent/20 px-1.5 py-0.5 text-[10px] text-foreground">
              Current
            </span>
          ) : null}

          {isComingSoon ? (
            <span className="rounded-sm bg-background-focus px-1.5 py-0.5 text-[10px] text-foreground-off">
              Coming soon
            </span>
          ) : null}
        </div>

        <p className="text-lg font-medium text-foreground">
          {option.price}
        </p>

        <p className="text-xs text-foreground-off">
          {option.description}
        </p>
      </header>

      <ul className="flex flex-1 flex-col gap-2 text-xs text-foreground-off">
        {option.features.map(feature => (
          <li
            key={feature}
            className="flex items-start gap-2">
            <IconCheck
              size={14}
              strokeWidth={1.8}
              aria-hidden="true"
              className="mt-px shrink-0 text-foreground" />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant={action.disabled ? "secondary" : "main"}
        disabled={action.disabled || props.isPending}
        onClick={props.onSelect}
        className="w-full">
        {props.isPending ? "Opening…" : action.label}
      </Button>
    </article>
  );
}
