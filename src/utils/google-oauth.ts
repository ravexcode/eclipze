import { GITHUB_OAUTH_ERROR_MESSAGES } from "@/constants/github-oauth";
import { GOOGLE_OAUTH_ERROR_MESSAGES } from "@/constants/google-oauth";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  ...GOOGLE_OAUTH_ERROR_MESSAGES,
  ...GITHUB_OAUTH_ERROR_MESSAGES,
};

// Resolves both Google and GitHub `?error=` codes shown on the sign-in page.
export function getGoogleOAuthErrorMessage(errorCode: string | undefined) {
  if (!errorCode || !Object.hasOwn(OAUTH_ERROR_MESSAGES, errorCode)) {
    return null;
  }

  return OAUTH_ERROR_MESSAGES[errorCode];
}
