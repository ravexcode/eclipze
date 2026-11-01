export const ENCRYPTION_KEY_ENV = "AI_CREDENTIALS_ENCRYPTION_KEY";

export const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// Prefix of the current ciphertext format: "v2.<iv>.<authTag>.<ciphertext>".
// Values without it use the legacy format "<iv>.<authTag>.<ciphertext>".
export const CURRENT_ENCRYPTION_VERSION = "v2";

// HKDF salt. Changing it changes every derived key and breaks existing ciphertext.
export const ENCRYPTION_KEY_SALT = "eclipze-encryption";

// Each purpose gets its own derived key, so credentials and content never share one.
export type EncryptionPurpose = "credentials" | "content";
