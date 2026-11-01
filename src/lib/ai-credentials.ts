import "server-only";

import { decryptValue, encryptValue } from "@/lib/encryption";

/**
 * Encrypts a stored credential (API key, MCP token, or database connection string).
 * `context` comes from src/utils/ai-credentials.ts and ties the value to its owner.
 */
export function encryptApiKey(apiKey: string, context: string) {
  return encryptValue(apiKey, {
    purpose: "credentials",
    context,
  });
}

/** Reads both the current format and credentials saved before contexts existed. */
export function decryptApiKey(value: string, context: string) {
  return decryptValue(value, {
    purpose: "credentials",
    context,
  });
}
