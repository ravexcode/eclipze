"use client";

import { useId, useState } from "react";

import {
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";

interface Props {
  type: "text" | "password" | "email";
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Visible label; when `hideLabel` is set it is only exposed to screen readers.
  label: string;
  hideLabel?: boolean;
  // One-time code field: large, centered, widely spaced digits.
  code?: boolean;
  placeholder?: string;
  pattern?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>["enterKeyHint"];
  // Defaults to off for email, password and code fields (iOS would capitalize/correct them).
  autoCapitalize?: string;
  spellCheck?: boolean;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
}

export default function Input(props: Props) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();

  const isPassword = props.type === "password";
  // Identifiers and secrets should reach the server exactly as typed.
  const isLiteral = props.type !== "text" || props.code;

  // 44px tall (Apple's minimum touch target) and 16px text, below which
  // iOS Safari zooms the page when the field is focused.
  const inputClass = [
    "h-11 w-full rounded-full border border-background-focus bg-background-card px-4 text-base text-foreground transition-colors placeholder:text-label-secondary/70 focus-visible:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
    isPassword ? "pr-12" : "",
    // indent offsets the trailing letter-spacing so the digits stay optically centered.
    props.code ? "text-center text-xl tracking-[0.5em] indent-[0.5em] placeholder:tracking-[0.5em]" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className="relative flex w-full flex-col gap-2">
      <label
        htmlFor={inputId}
        className={props.hideLabel
          ? "sr-only"
          : "w-full px-1 text-start text-xs font-medium uppercase tracking-wide text-label-secondary"}>
        {props.label}
      </label>
      <div
        className="relative w-full">
        <input
          id={inputId}
          type={isPassword && visible ? "text" : props.type}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder}
          pattern={props.pattern}
          autoComplete={props.autoComplete}
          inputMode={props.inputMode ?? (props.type === "email" ? "email" : undefined)}
          enterKeyHint={props.enterKeyHint}
          autoCapitalize={props.autoCapitalize ?? (isLiteral ? "none" : undefined)}
          autoCorrect={isLiteral ? "off" : undefined}
          spellCheck={props.spellCheck ?? (isLiteral ? false : undefined)}
          maxLength={props.maxLength}
          minLength={props.minLength}
          required={props.required}
          disabled={props.disabled}
          className={inputClass}
        />
        {
          isPassword &&
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent">
            {
              visible ?
                <IconEyeOff
                  size={20} /> :
                <IconEye
                  size={20} />
            }
          </button>
        }
      </div>
    </div>
  );
}
