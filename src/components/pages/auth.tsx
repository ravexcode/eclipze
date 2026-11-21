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
        if (type === "up") {
          setError("You must accept the terms and privacy policy to create an account.");
          return;
        }

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

  const linkClass = "text-brand underline transition-colors duration-300 hover:text-foreground";

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
                type="email"
                placeholder="jhondoe@gmail.com"
                autoComplete="email"
                required
              />

              <Input
                value={user.password}
                onChange={updateUser("password")}
                label="Password"
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
                type="email"
                placeholder="jhondoe@gmail.com"
                autoComplete="email"
                required
              />

              <Input
                value={user.password}
                onChange={updateUser("password")}
                label="Password"
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
              centered
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
          <p className="w-full rounded-2xl border border-alert-red/40 bg-alert-red/10 px-3 py-2.5 text-xs leading-5 text-red-200">
            {error}
            {errorAction && <Link className="ml-2 underline" href={errorAction.href}>{errorAction.label}</Link>}
          </p>
        }

        <Button
          type="submit"
          variant="brand"
          disabled={isSubmitting}
          className="mt-2.5 h-9 min-h-0 w-full cursor-pointer rounded-full! text-xs font-normal">
          {isSubmitting ? "Please wait..." : step === "credentials" ? "Continue" : "Confirm"}
        </Button>

        {
          step === "credentials" ? <>
            <AuthProviders />

            <div
              className="mt-2 flex w-full flex-col items-center gap-1.5 text-center text-[11px] text-balance text-foreground">
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
                  className={linkClass}>
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
            <div className="flex w-full items-center justify-between gap-3 text-xs text-foreground-off">
              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setVerificationCode("");
                  setError(null);
                }}
                className="underline transition-colors duration-300 hover:text-foreground cursor-pointer">
                Change email
              </button>

              <button
                type="button"
                onClick={resendCode}
                disabled={isSubmitting}
                className="underline transition-colors duration-300 hover:text-foreground cursor-pointer disabled:opacity-50">
                Resend code
              </button>
            </div>
        }
      </Form>
    </AuthShell>
  );
}
