export const GITHUB_AUTHORIZATION_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_USER_URL = "https://api.github.com/user";
export const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";
export const GITHUB_API_USER_AGENT = "Eclipze";

export const GITHUB_OAUTH_SCOPES = ["read:user", "user:email"];

export const GITHUB_OAUTH_CALLBACK_PATH = "/api/auth/github/callback";
export const GITHUB_OAUTH_COOKIE_PATH = "/api/auth/github";
export const GITHUB_OAUTH_STATE_COOKIE = "github_oauth_state";
export const GITHUB_OAUTH_VERIFIER_COOKIE = "github_oauth_verifier";
export const GITHUB_OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10;

export const GITHUB_OAUTH_TRANSACTION_MAX_WAIT_MS = 10_000;
export const GITHUB_OAUTH_TRANSACTION_TIMEOUT_MS = 20_000;

export const GITHUB_OAUTH_ERROR_MESSAGES = {
  github_not_configured: "GitHub sign-in is not available right now.",
  github_cancelled: "GitHub sign-in was cancelled.",
  github_invalid_state: "Your GitHub sign-in session expired. Please try again.",
  github_failed: "We could not sign you in with GitHub. Please try again.",
  github_email_unverified: "Your GitHub account has no verified primary email address.",
  github_account_conflict: "This email is already linked to a different GitHub account.",
} as const;

export type GithubOAuthErrorCode = keyof typeof GITHUB_OAUTH_ERROR_MESSAGES;
