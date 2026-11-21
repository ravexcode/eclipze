import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  GITHUB_OAUTH_COOKIE_PATH,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_OAUTH_VERIFIER_COOKIE,
  type GithubOAuthErrorCode,
} from "@/constants/github-oauth";
import {
  createSession,
  describeDevice,
  getRequestIp,
} from "@/lib/auth";
import { sendNewSignInEmail } from "@/lib/auth-email";
import { sendEmailAfterResponse } from "@/lib/email-delivery";
import {
  fetchGithubProfile,
  findOrCreateGithubUser,
  getGithubOAuthConfig,
} from "@/lib/github-oauth";
import { getAppOrigin } from "@/lib/google-oauth";
import { recordCurrentLegalAcceptance } from "@/lib/legal-acceptance";

export async function GET(request: Request) {
  const appOrigin = getAppOrigin(request);
  const searchParams = new URL(request.url).searchParams;
  const cookieStore = await cookies();

  const storedState = cookieStore.get(GITHUB_OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(GITHUB_OAUTH_VERIFIER_COOKIE)?.value;

  cookieStore.delete({ name: GITHUB_OAUTH_STATE_COOKIE, path: GITHUB_OAUTH_COOKIE_PATH });
  cookieStore.delete({ name: GITHUB_OAUTH_VERIFIER_COOKIE, path: GITHUB_OAUTH_COOKIE_PATH });

  const redirectWithError = (errorCode: GithubOAuthErrorCode) => {
    return NextResponse.redirect(new URL(`/auth/signin?error=${errorCode}`, appOrigin));
  };

  const config = getGithubOAuthConfig(request);

  if (!config) {
    return redirectWithError("github_not_configured");
  }

  if (searchParams.get("error")) {
    return redirectWithError("github_cancelled");
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return redirectWithError("github_invalid_state");
  }

  const profile = await fetchGithubProfile({
    config,
    code,
    codeVerifier,
  }).catch((error: unknown) => {
    console.error("[github-oauth] Profile fetch threw:", error);
    return null;
  });

  if (!profile) {
    return redirectWithError("github_failed");
  }

  const result = await findOrCreateGithubUser(profile).catch((error: unknown) => {
    console.error("[github-oauth] User lookup failed:", error);

    return {
      error: "github_failed" as GithubOAuthErrorCode,
    };
  });

  if ("error" in result) {
    return redirectWithError(result.error);
  }

  await recordCurrentLegalAcceptance(result.user.id);
  await createSession(result.user.id);
  // Captured now, so the notice shows the sign-in time rather than the send time.
  const signInNotice = {
    to: result.user.email,
    ip: getRequestIp(request),
    device: describeDevice(request.headers.get("user-agent")),
    occurredAt: new Date().toISOString(),
  };

  sendEmailAfterResponse("Sign-in notice", () => sendNewSignInEmail(signInNotice));

  return NextResponse.redirect(new URL("/dashboard", appOrigin));
}
