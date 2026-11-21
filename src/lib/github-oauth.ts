import "server-only";

import type { User } from "@prisma/client";

import {
  GITHUB_API_USER_AGENT,
  GITHUB_AUTHORIZATION_URL,
  GITHUB_EMAILS_URL,
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_OAUTH_SCOPES,
  GITHUB_OAUTH_TRANSACTION_MAX_WAIT_MS,
  GITHUB_OAUTH_TRANSACTION_TIMEOUT_MS,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
  type GithubOAuthErrorCode,
} from "@/constants/github-oauth";
import prisma from "@/lib/prisma";
import { createInitialAiCreditGrant } from "@/lib/ai-credits";
import { isValidEmail, normalizeEmail } from "@/lib/auth";
import { getAppOrigin } from "@/lib/google-oauth";

type GithubOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type GithubProfile = {
  id: string;
  // Null when GitHub has no verified primary email for the account.
  email: string | null;
  avatarUrl: string | null;
};

type GithubUserResult =
  | { user: User }
  | { error: GithubOAuthErrorCode };

export function getGithubOAuthConfig(request: Request): GithubOAuthConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${getAppOrigin(request)}${GITHUB_OAUTH_CALLBACK_PATH}`,
  };
}

export function createGithubAuthorizationUrl(input: {
  config: GithubOAuthConfig;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL(GITHUB_AUTHORIZATION_URL);

  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.config.redirectUri);
  url.searchParams.set("scope", GITHUB_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("allow_signup", "true");

  return url;
}

function githubApiHeaders(accessToken: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": GITHUB_API_USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function fetchGithubProfile(input: {
  config: GithubOAuthConfig;
  code: string;
  codeVerifier: string;
}): Promise<GithubProfile | null> {
  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      redirect_uri: input.config.redirectUri,
      code_verifier: input.codeVerifier,
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    console.error("[github-oauth] Token exchange failed:", tokenResponse.status, await tokenResponse.text());
    return null;
  }

  // GitHub reports token errors with a 200 status and an `error` field.
  const tokens = await tokenResponse.json() as { access_token?: string; error?: string };

  if (!tokens.access_token) {
    console.error("[github-oauth] Token exchange returned no token:", tokens.error);
    return null;
  }

  const headers = githubApiHeaders(tokens.access_token);

  const [userResponse, emailsResponse] = await Promise.all([
    fetch(GITHUB_USER_URL, { headers, cache: "no-store" }),
    fetch(GITHUB_EMAILS_URL, { headers, cache: "no-store" }),
  ]);

  if (!userResponse.ok || !emailsResponse.ok) {
    console.error("[github-oauth] Profile request failed:", userResponse.status, emailsResponse.status);
    return null;
  }

  const user = await userResponse.json() as { id?: number; avatar_url?: string };
  const emails = await emailsResponse.json() as Array<{ email?: string; primary?: boolean; verified?: boolean }>;

  if (!user.id) {
    return null;
  }

  const primary = Array.isArray(emails)
    ? emails.find((entry) => entry.primary && entry.verified && entry.email && isValidEmail(entry.email))
    : undefined;

  return {
    id: String(user.id),
    email: primary?.email ? normalizeEmail(primary.email) : null,
    avatarUrl: user.avatar_url ?? null,
  };
}

export async function findOrCreateGithubUser(profile: GithubProfile): Promise<GithubUserResult> {
  return prisma.$transaction(async (transaction): Promise<GithubUserResult> => {
    const linkedAccount = await transaction.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "GITHUB",
          providerAccountId: profile.id,
        },
      },
      include: {
        user: true,
      },
    });

    if (linkedAccount) {
      return {
        user: linkedAccount.user,
      };
    }

    if (!profile.email) {
      return {
        error: "github_email_unverified",
      };
    }

    const existingUser = await transaction.user.findUnique({
      where: {
        email: profile.email,
      },
    });

    if (existingUser) {
      const existingGithubAccount = await transaction.authAccount.findUnique({
        where: {
          userId_provider: {
            userId: existingUser.id,
            provider: "GITHUB",
          },
        },
      });

      if (existingGithubAccount) {
        return {
          error: "github_account_conflict",
        };
      }

      await transaction.authAccount.create({
        data: {
          userId: existingUser.id,
          provider: "GITHUB",
          providerAccountId: profile.id,
        },
      });

      // An unverified account was never proven to belong to this email owner,
      // so its password is discarded before GitHub verifies the address.
      const updatedUser = await transaction.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
          passwordHash: existingUser.emailVerifiedAt ? existingUser.passwordHash : null,
          avatarUrl: existingUser.avatarUrl ?? profile.avatarUrl,
        },
      });

      return {
        user: updatedUser,
      };
    }

    const createdUser = await transaction.user.create({
      data: {
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        emailVerifiedAt: new Date(),
        role: "USER",
        accounts: {
          create: {
            provider: "GITHUB",
            providerAccountId: profile.id,
          },
        },
      },
    });

    await createInitialAiCreditGrant(transaction, createdUser.id);

    return {
      user: createdUser,
    };
  }, {
    maxWait: GITHUB_OAUTH_TRANSACTION_MAX_WAIT_MS,
    timeout: GITHUB_OAUTH_TRANSACTION_TIMEOUT_MS,
  });
}
