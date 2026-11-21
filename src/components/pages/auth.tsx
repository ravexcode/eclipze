"use client";

import { useMemo, useState } from "react";

import type {
  AuthApiResponse,
  AuthCodePurpose,
  AuthStep,
  UserCredentials,
} from "@/types/user";

import Form from "@/components/forms/auth/form";
import Input from "@/components/forms/auth/input";
import AuthProviders from "@/components/forms/auth/providers";
import AuthShell from "@/components/forms/auth/shell";
import Button from "@/components/ui/button";
import { useAnnouncements } from "@/components/announcements/announcement-provider";
import { apiFetch } from "@/utils/api-fetch";
import { invalidateSessionUser } from "@/utils/session";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthPage(
  { type, initialError = null }:
    { type: "in" | "up"; initialError?: string | null }
) {
  const router = useRouter();
  const { announce } = useAnnouncements();
  const defaultUser = type === "in"
    ? { email: "", password: "" }
    : { email: "", username: "", password: "", password_confirm: "" };

  const [user, setUser] = useState<UserCredentials>(defaultUser);
  const [step, setStep] = useState<AuthStep>("credentials");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorAction, setErrorAction] = useState<{ href: string; label: string } | null>(null);

  const greeting = useMemo(() => {
    if (step === "verify_email") {
      return "Confirm your email";
    }

    return type === "in" ? "Welcome Back!" : "Get started";
  }, [step, type]);

  const onSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError(null);
    setErrorAction(null);
    setIsSubmitting(true);

    try {
      if (step === "credentials") {
        const endpoint = type === "in" ? "/api/auth/signin" : "/api/auth/signup";
        const response = await apiFetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(user),
        });

        const data = await response.json() as AuthApiResponse;

        if (!response.ok) {
          setError(data.message);
          if (data.actionHref && data.actionLabel) setErrorAction({ href: data.actionHref, label: data.actionLabel });
          return;
        }

        if (type === "in") {
          announce({ message: "Login successful!", variant: "success" });
          invalidateSessionUser();
          router.push(data.redirectTo ?? "/dashboard");
          router.refresh();
          return;
        }

        setPendingEmail(data.email ?? user.email);
        setStep(data.nextStep ?? "credentials");
        setVerificationCode("");
        announce({ message: data.message, variant: "info" });
        return;
      }

      const response = await apiFetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: pendingEmail || user.email,
          code: verificationCode,
        }),
      });

      const data = await response.json() as AuthApiResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      invalidateSessionUser();
      announce({ message: "Email verified. You are now signed in.", variant: "success" });
      router.push(data.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Unable to complete your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("Please review the form fields and try again.");
  };

  const resendCode = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/auth/resend-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: pendingEmail || user.email,
          purpose: "EMAIL_VERIFICATION" as AuthCodePurpose,
        }),
      });

      const data = await response.json() as AuthApiResponse;

      if (!response.ok) {
        setError(data.message);
        return;
      }

      announce({ message: data.message, variant: "success" });
    } catch {
      setError("Unable to resend the code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const updateUser = (field: keyof UserCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setUser(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const linkClass = "text-foreground underline underline-offset-2 transition-colors duration-300 hover:text-brand";
  // Standalone links get a 44px-tall hit area; inline ones stay in the text flow.
  const standaloneLinkClass = `inline-flex min-h-11 items-center px-2 ${linkClass}`;

  return (
    <AuthShell
      title={greeting}
      description={step !== "credentials" && <>
        We&apos;ve sent you an email with a code, put it there
        <br />
        <span className="text-foreground">{pendingEmail || user.email}</span>
      </>}>
      <Form
        onSubmit={onSubmit}
        onError={onError}>
        {
          step === "credentials" ? (
            type === "in" ? <>
              <Input
                value={user.email}
                onChange={updateUser("email")}
                label="Email"
                enterKeyHint="next"
                type="email"
                placeholder="jhondoe@gmail.com"
                autoComplete="email"
                required
              />

              <Input
                value={user.password}
                onChange={updateUser("password")}
                label="Password"
                enterKeyHint="go"
                type="password"
                placeholder="••••••••••"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </> : <>
              <Input
                value={user.username ?? ""}
                onChange={updateUser("username")}
                label="Username"
                enterKeyHint="next"
                autoCapitalize="none"
                spellCheck={false}
                type="text"
                placeholder="Jhon Doe"
                autoComplete="username"
                minLength={3}
                maxLength={24}
                required
              />

              <Input
                value={user.email}
                onChange={updateUser("email")}
                label="Email"
                enterKeyHint="next"
                type="email"
                placeholder="jhondoe@gmail.com"
                autoComplete="email"
                required
              />

              <Input
                value={user.password}
                onChange={updateUser("password")}
                label="Password"
                enterKeyHint="next"
                type="password"
                placeholder="••••••••••"
                autoComplete="new-password"
                minLength={8}
                required
              />

              <Input
                value={user.password_confirm ?? ""}
                onChange={updateUser("password_confirm")}
                label="Confirm password"
                enterKeyHint="go"
                type="password"
                placeholder="••••••••••"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </>
          ) : (
            <Input
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              label="Verification code"
              hideLabel
              code
              enterKeyHint="done"
              type="text"
              inputMode="numeric"
              placeholder="XXXXXX"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          )
        }

        {
          error &&
          <p role="alert"
            className="w-full rounded-2xl border border-alert-red/40 bg-alert-red/10 px-4 py-3 text-sm leading-5 text-red-200">
            {error}
            {errorAction && <Link className="ml-2 underline" href={errorAction.href}>{errorAction.label}</Link>}
          </p>
        }

        <Button
          type="submit"
          variant="brand"
          disabled={isSubmitting}
          className="mt-2 h-11 min-h-0 w-full cursor-pointer rounded-full! text-base! font-medium">
          {isSubmitting ? "Please wait..." : step === "credentials" ? "Continue" : "Confirm"}
        </Button>

        {
          step === "credentials" ? <>
            <AuthProviders />

            <div
              className="flex w-full flex-col items-center gap-1 text-center text-[13px] leading-5 text-balance text-label-secondary">
              <p>
                By signing {type} you accept our <Link
                  href="/legal/tos"
                  className={linkClass}>
                  Terms of Service
                </Link> and <Link
                  href="/legal/privacy"
                  className={linkClass}>
                  Privacy Policy
                </Link>
              </p>

              {
                type === "in" &&
                <Link
                  href="/auth/forgot-password"
                  className={standaloneLinkClass}>
                  Forgot your password?
                </Link>
              }

              <p>
                {type === "in" ? "Don't have an account?" : "Already have an account?"} <Link
                  href={type === "in" ? "/auth/signup" : "/auth/signin"}
                  className={linkClass}>
                  {type === "in" ? "Sign up" : "Sign in"}
                </Link>
              </p>
            </div>
          </> :
            <div className="flex w-full items-center justify-between gap-3 text-[15px] text-label-secondary">
              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setVerificationCode("");
                  setError(null);
                }}
                className="min-h-11 px-2 underline underline-offset-2 transition-colors duration-300 hover:text-foreground cursor-pointer">
                Change email
              </button>

              <button
                type="button"
                onClick={resendCode}
                disabled={isSubmitting}
                className="min-h-11 px-2 underline underline-offset-2 transition-colors duration-300 hover:text-foreground cursor-pointer disabled:opacity-50">
                Resend code
              </button>
            </div>
        }
      </Form>
    </AuthShell>
  );
}
