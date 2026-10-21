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
      className={`flex flex-col gap-4 rounded-md text-sm bg-background-card p-4`}>
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground">
            {option.name}
          </h3>

          {option.isCurrent ? (
            <span className="rounded-full bg-accent/20 px-3 py-1 text-xs text-foreground">
              Current
            </span>
          ) : null}

          {isComingSoon ? (
            <span className="rounded-full bg-background-focus px-3 py-1 text-xs text-foreground-off">
              Coming soon
            </span>
          ) : null}
        </div>

        <p className="text-lg font-medium text-foreground">
          {isComingSoon ? "Coming soon..." : option.price}
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
        className="w-full h-8 cursor-pointer disabled:cursor-not-allowed disabled:brightness-75">
        {props.isPending ? "Opening…" : action.label}
      </Button>
    </article>
  );
}
