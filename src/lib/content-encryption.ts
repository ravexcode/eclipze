import "server-only";

import type { Prisma } from "@prisma/client";

import {
  CONTENT_ENCRYPTION_PREFIX,
  ENCRYPTED_JSON_KEY,
  type ContentField,
} from "@/constants/encryption";
import { decryptValue, encryptValue } from "@/lib/encryption";

export function encryptContent(value: string, field: ContentField) {
  const ciphertext = encryptValue(value, {
    purpose: "content",
    context: field,
  });

  return `${CONTENT_ENCRYPTION_PREFIX}${ciphertext}`;
}

/**
 * Returns plaintext rows written before content encryption unchanged. If a value that
 * looks encrypted cannot be decrypted, it is most likely such a plaintext row that
 * happens to start with the prefix, so it is returned unchanged as well.
 */
export function decryptContent(value: string, field: ContentField) {
  if (!value.startsWith(CONTENT_ENCRYPTION_PREFIX)) {
    return value;
  }

  try {
    return decryptValue(value.slice(CONTENT_ENCRYPTION_PREFIX.length), {
      purpose: "content",
      context: field,
    });
  } catch {
    console.error(`[encryption] A ${field} value could not be decrypted.`);
    return value;
  }
}

export function decryptOptionalContent(value: string | null, field: ContentField) {
  return value === null ? null : decryptContent(value, field);
}

export function encryptContentJson(
  value: Prisma.InputJsonValue | undefined,
  field: ContentField,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return {
    [ENCRYPTED_JSON_KEY]: encryptContent(JSON.stringify(value), field),
  };
}

export function decryptContentJson(value: unknown, field: ContentField): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const encryptedValue = record[ENCRYPTED_JSON_KEY];
  const isEncryptedWrapper = typeof encryptedValue === "string" && Object.keys(record).length === 1;

  if (!isEncryptedWrapper) {
    return value;
  }

  try {
    return JSON.parse(decryptContent(encryptedValue, field)) as unknown;
  } catch {
    return null;
  }
}
