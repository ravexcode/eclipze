export const ENCRYPTION_KEY_ENV = "AI_CREDENTIALS_ENCRYPTION_KEY";

export const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// Prefix of the current ciphertext format: "v2.<iv>.<authTag>.<ciphertext>".
// Values without it use the legacy format "<iv>.<authTag>.<ciphertext>".
export const CURRENT_ENCRYPTION_VERSION = "v2";

// HKDF salt. Changing it changes every derived key and breaks existing ciphertext.
export const ENCRYPTION_KEY_SALT = "eclipze-encryption";

// Each purpose gets its own derived key, so credentials and content never share one.
export type EncryptionPurpose = "credentials" | "content";

// Marks encrypted text columns. Values without it are plaintext written before content
// encryption, and are returned as they are.
export const CONTENT_ENCRYPTION_PREFIX = "enc:";

// Encrypted JSON columns store { "$encrypted": "enc:..." } in place of the original value.
export const ENCRYPTED_JSON_KEY = "$encrypted";

// Each field is its own encryption context, so a value cannot be moved to another field.
export type ContentField =
  | "mail.subject"
  | "mail.body"
  | "issue-message.body"
  | "agent-run.prompt"
  | "agent-run-event.message"
  | "agent-run-event.metadata";
