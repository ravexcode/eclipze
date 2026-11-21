"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Form from "@/components/forms/auth/form";
import Input from "@/components/forms/auth/input";
import AuthShell from "@/components/forms/auth/shell";
import Button from "@/components/ui/button";
import { apiFetch } from "@/utils/api-fetch";

function FormError({ message }: { message: string }) {
  return message ? <p className="w-full rounded-2xl border border-alert-red/40 bg-alert-red/10 px-3 py-2.5 text-xs leading-6 text-red-200">{message}</p> : null;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.message); return; }
      setSent(true);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Reset your password" backHref="/auth/signin" description={sent ? undefined : "Insert your email so we can send you a verification code"}>
      {sent ? (
        <p className="text-center text-xs leading-6 text-foreground-off">
          If an eligible account exists, a reset code was sent. {" "}
          <Link className="text-brand underline" href={`/auth/reset-password?email=${encodeURIComponent(email)}`}>Continue with code</Link>.
        </p>
      ) : (
        <Form onSubmit={submit} onError={(event) => { event.preventDefault(); setError("Please review the form fields and try again."); }}>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} label="Email" hideLabel type="email" placeholder="jhondoe@gmail.com" autoComplete="email" required />
          <FormError message={error} />
        <Button type="submit" variant="brand" disabled={busy} className="mt-2.5 h-9 min-h-0 w-full rounded-full! text-xs font-normal">{busy ? "Please wait..." : "Continue"}</Button>
        </Form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password, password_confirm: confirm }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.message); return; }
      router.push(data.redirectTo ?? "/auth/signin");
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Choose a new password" backHref="/auth/signin" description="Enter the code we sent to your email and your new password">
      <Form onSubmit={submit} onError={(event) => { event.preventDefault(); setError("Please review the form fields and try again."); }}>
        <Input value={email} onChange={(event) => setEmail(event.target.value)} label="Email" type="email" placeholder="jhondoe@gmail.com" autoComplete="email" required />
        <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} label="6-digit code" type="text" inputMode="numeric" placeholder="XXXXXX" autoComplete="one-time-code" maxLength={6} required />
        <Input value={password} onChange={(event) => setPassword(event.target.value)} label="New password" type="password" placeholder="••••••••••" autoComplete="new-password" minLength={8} required />
        <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} label="Confirm password" type="password" placeholder="••••••••••" autoComplete="new-password" minLength={8} required />
        <FormError message={error} />
        <Button type="submit" variant="brand" disabled={busy} className="mt-2.5 h-9 min-h-0 w-full rounded-full! text-xs font-normal">{busy ? "Please wait..." : "Continue"}</Button>
      </Form>
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [code, setCode] = useState("");
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/auth/verify-email", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.message); return; }
      router.push(data.redirectTo ?? "/dashboard");
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/auth/resend-code", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, purpose: "EMAIL_VERIFICATION" }),
      });
      const data = await response.json(); setMessage(data.message); if (!response.ok) setError(data.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Confirm your email" backHref="/auth/signin" description="We've sent you an email with a code, put it there">
      <Form onSubmit={submit} onError={(event) => event.preventDefault()}>
        <Input value={email} onChange={(event) => setEmail(event.target.value)} label="Email" type="email" placeholder="jhondoe@gmail.com" autoComplete="email" required />
        <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} label="6-digit code" type="text" inputMode="numeric" placeholder="XXXXXX" autoComplete="one-time-code" maxLength={6} required />
        <FormError message={error} />
        {message && !error && <p className="w-full text-xs leading-6 text-foreground-off">{message}</p>}
        <Button type="submit" variant="brand" disabled={busy} className="mt-2.5 h-9 min-h-0 w-full rounded-full! text-xs font-normal">{busy ? "Please wait..." : "Confirm"}</Button>
        <button type="button" onClick={resend} disabled={busy} className="mt-1 text-xs text-foreground-off underline transition-colors hover:text-foreground disabled:opacity-50">Resend code</button>
      </Form>
    </AuthShell>
  );
}
