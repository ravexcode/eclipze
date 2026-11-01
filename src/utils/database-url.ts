const TLS_REQUIRED_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * True when a PostgreSQL URL forces TLS, or points at the local machine or a
 * single-label host such as a Docker Compose service ("db"), where TLS is not needed. Returns true for URLs it cannot parse, so it never blocks startup.
 */
export function isDatabaseUrlTlsEnforced(databaseUrl: string) {
  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    return true;
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (LOCAL_DATABASE_HOSTS.has(hostname) || !hostname.includes(".")) {
    return true;
  }

  const sslMode = url.searchParams.get("sslmode");

  return sslMode !== null && TLS_REQUIRED_SSL_MODES.has(sslMode);
}
