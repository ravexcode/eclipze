import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import {
  CURRENT_ENCRYPTION_VERSION,
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_KEY_ENV,
  ENCRYPTION_KEY_SALT,
  type EncryptionPurpose,
} from "@/constants/encryption";

export type EncryptionScope = {
  purpose: EncryptionPurpose;
  // Bound to the ciphertext as AES-GCM additional data. Decryption fails unless the same
  // context is given, so a value copied to another user or field cannot be read there.
  context: string;
};

function getMasterSecret() {
  const secret = process.env[ENCRYPTION_KEY_ENV];

  if (!secret) {
    throw new Error(`${ENCRYPTION_KEY_ENV} is not configured.`);
  }

  return secret;
}

function getPurposeKey(purpose: EncryptionPurpose) {
  const derivedKey = hkdfSync(
    "sha256",
    getMasterSecret(),
    ENCRYPTION_KEY_SALT,
    `${purpose}:${CURRENT_ENCRYPTION_VERSION}`,
    32,
  );

  return Buffer.from(derivedKey);
}

// Key of the legacy format, used before purposes and contexts existed.
function getLegacyKey() {
  return createHash("sha256").update(getMasterSecret()).digest();
}

function decryptParts(input: {
  key: Buffer;
  iv: string;
  authTag: string;
  ciphertext: string;
  additionalData?: string;
}) {
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    input.key,
    Buffer.from(input.iv, "base64url"),
  );

  if (input.additionalData !== undefined) {
    decipher.setAAD(Buffer.from(input.additionalData, "utf8"));
  }

  decipher.setAuthTag(Buffer.from(input.authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptValue(plaintext: string, scope: EncryptionScope) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getPurposeKey(scope.purpose), iv);

  cipher.setAAD(Buffer.from(scope.context, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    CURRENT_ENCRYPTION_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptValue(value: string, scope: EncryptionScope) {
  const parts = value.split(".");

  if (parts.length === 4 && parts[0] === CURRENT_ENCRYPTION_VERSION) {
    const [, iv, authTag, ciphertext] = parts;

    return decryptParts({
      key: getPurposeKey(scope.purpose),
      iv,
      authTag,
      ciphertext,
      additionalData: scope.context,
    });
  }

  // Only credentials were stored in the legacy format.
  if (parts.length === 3 && scope.purpose === "credentials") {
    const [iv, authTag, ciphertext] = parts;

    return decryptParts({
      key: getLegacyKey(),
      iv,
      authTag,
      ciphertext,
    });
  }

  throw new Error("Invalid encrypted value.");
}

export function isCurrentEncryptionFormat(value: string) {
  return value.startsWith(`${CURRENT_ENCRYPTION_VERSION}.`);
}
