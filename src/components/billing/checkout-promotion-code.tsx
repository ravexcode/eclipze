"use client";

import { useState, type FormEvent } from "react";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

export default function CheckoutPromotionCode(props: {
  appliedCodes: string[];
  onApply(code: string): Promise<string | null>;
  onRemove(): Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const appliedCode = props.appliedCodes[0] ?? null;

  const apply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!code.trim()) {
      return;
    }

    setIsPending(true);
    const applyError = await props.onApply(code.trim());
    setIsPending(false);
    setError(applyError);

    if (!applyError) {
      setCode("");
    }
  };

  const remove = async () => {
    setIsPending(true);
    setError(await props.onRemove());
    setIsPending(false);
  };

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-foreground-off">
          Promotion code <span className="text-foreground">{appliedCode}</span> applied
        </span>

        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => void remove()}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={event => void apply(event)}
      className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={code}
          onChange={setCode}
          placeholder="Promotion code"
          aria-label="Promotion code"
          autoComplete="off"
          className="min-w-0 flex-1" />

        <Button
          type="submit"
          variant="secondary"
          disabled={isPending || !code.trim()}>
          {isPending ? "Applying…" : "Apply"}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-xs text-alert-red">
          {error}
        </p>
      ) : null}
    </form>
  );
}
