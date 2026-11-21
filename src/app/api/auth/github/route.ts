import { NextResponse } from "next/server";

import {
  GITHUB_OAUTH_COOKIE_MAX_AGE_SECONDS,
  GITHUB_OAUTH_COOKIE_PATH,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_OAUTH_VERIFIER_COOKIE,
} from "@/constants/github-oauth";
import {
  createGithubAuthorizationUrl,
  getGithubOAuthConfig,
} from "@/lib/github-oauth";
import {
  createOAuthState,
  createPkcePair,
  getAppOrigin,
} from "@/lib/google-oauth";

export async function GET(request: Request) {
  const config = getGithubOAuthConfig(request);

  if (!config) {
    return NextResponse.redirect(new URL("/auth/signin?error=github_not_configured", getAppOrigin(request)));
  }

  const state = createOAuthState();
  const { codeVerifier, codeChallenge } = createPkcePair();

  const response = NextResponse.redirect(createGithubAuthorizationUrl({
    config,
    state,
    codeChallenge,
  }));

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: GITHUB_OAUTH_COOKIE_PATH,
    maxAge: GITHUB_OAUTH_COOKIE_MAX_AGE_SECONDS,
  };

  response.cookies.set(GITHUB_OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(GITHUB_OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOptions);

  return response;
}
