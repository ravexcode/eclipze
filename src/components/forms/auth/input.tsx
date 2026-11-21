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
  centered?: boolean;
  placeholder?: string;
  pattern?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
}

export default function Input(props: Props) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();

  const isPassword = props.type === "password";

  const inputClass = [
    "h-9 w-full rounded-full border border-background-focus bg-background-card px-3.5 text-xs text-foreground transition-colors placeholder:text-foreground-off focus:border-brand focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
    isPassword ? "pr-10" : "",
    props.centered ? "text-center" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className="relative flex w-full flex-col items-center justify-center gap-1.5">
      <label
        htmlFor={inputId}
        className={props.hideLabel
          ? "sr-only"
          : "w-full text-start text-[10px] uppercase tracking-wide text-foreground-off"}>
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
          inputMode={props.inputMode}
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
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-foreground-off transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-brand">
            {
              visible ?
                <IconEyeOff
                  size={16} /> :
                <IconEye
                  size={16} />
            }
          </button>
        }
      </div>
    </div>
  );
}
