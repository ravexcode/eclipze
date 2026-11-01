export type SecurityNoticeKind =
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "ACCOUNT_DELETED"
  | "SIGNUP_ATTEMPT";

type SecurityNoticeCopy = {
  subject: string;
  title: string;
  body: string;
  // Shown after the request details; tells the user what to do if they did not act.
  advice: string;
};

export const SECURITY_NOTICE_COPY: Record<SecurityNoticeKind, SecurityNoticeCopy> = {
  PASSWORD_CHANGED: {
    subject: "Your Eclipze password was changed",
    title: "Your password was changed",
    body: "The password for your Eclipze account was changed from your account settings. Other active sessions were signed out.",
    advice: "If you did not make this change, reset your password immediately and contact support.",
  },
  PASSWORD_RESET: {
    subject: "Your Eclipze password was reset",
    title: "Your password was reset",
    body: "The password for your Eclipze account was reset with a recovery code. All active sessions were signed out.",
    advice: "If you did not reset your password, reset it again immediately and contact support.",
  },
  ACCOUNT_DELETED: {
    subject: "Your Eclipze account was deleted",
    title: "Your account was deleted",
    body: "Your Eclipze account and its data were deleted.",
    advice: "If you did not delete your account, contact support immediately.",
  },
  SIGNUP_ATTEMPT: {
    subject: "Someone tried to sign up with your email",
    title: "Sign-up attempt with your email",
    body: "Someone tried to create a new Eclipze account with this email address, but an account already exists. No new account was created.",
    advice: "If this was you, sign in or reset your password. Otherwise, you can ignore this email.",
  },
};
