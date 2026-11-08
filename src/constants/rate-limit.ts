const MINUTE_MS = 1000 * 60;
const HOUR_MS = MINUTE_MS * 60;

export type RateLimitRule = {
  // Stable name that groups counters in the database; changing it resets the counters.
  name: string;
  limit: number;
  windowMs: number;
};

export const RATE_LIMIT_RULES = {
  signInByIp: {
    name: "auth.signin.ip",
    limit: 20,
    windowMs: 15 * MINUTE_MS,
  },
  signInByEmail: {
    name: "auth.signin.email",
    limit: 5,
    windowMs: 15 * MINUTE_MS,
  },
  signUpByIp: {
    name: "auth.signup.ip",
    limit: 5,
    windowMs: HOUR_MS,
  },
  verifyCodeByIp: {
    name: "auth.verify-code.ip",
    limit: 10,
    windowMs: 15 * MINUTE_MS,
  },
  sendCodeByIp: {
    name: "auth.send-code.ip",
    limit: 10,
    windowMs: HOUR_MS,
  },
  sendCodeByEmail: {
    name: "auth.send-code.email",
    limit: 3,
    windowMs: HOUR_MS,
  },
  passwordCheckByUser: {
    name: "account.password-check.user",
    limit: 5,
    windowMs: 15 * MINUTE_MS,
  },
  mailSendByUser: {
    name: "mails.send.user",
    limit: 20,
    windowMs: MINUTE_MS,
  },
} as const satisfies Record<string, RateLimitRule>;

// Expired buckets are removed on roughly this share of rate limit checks.
export const RATE_LIMIT_CLEANUP_PROBABILITY = 0.01;

// A verification code is rejected after this many checks, even before it expires.
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5;
