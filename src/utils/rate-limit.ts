export function getRetryAfterSeconds(expiresAt: Date, now: Date) {
  const remainingMs = expiresAt.getTime() - now.getTime();

  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export function formatRateLimitMessage(retryAfterSeconds: number) {
  if (retryAfterSeconds < 60) {
    const unit = retryAfterSeconds === 1 ? "second" : "seconds";

    return `Too many attempts. Try again in ${retryAfterSeconds} ${unit}.`;
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);
  const unit = minutes === 1 ? "minute" : "minutes";

  return `Too many attempts. Try again in ${minutes} ${unit}.`;
}
