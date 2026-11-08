// sslmode values that make PostgreSQL clients refuse unencrypted connections.
export const TLS_REQUIRED_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

export const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
