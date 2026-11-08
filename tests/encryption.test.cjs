const assert = require("node:assert/strict");
const { createCipheriv, createHash, randomBytes } = require("node:crypto");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const SECRET = "test-encryption-secret";

function loadEncryption(secret = SECRET) {
  return loadTypeScript("src/lib/encryption.ts", {
    globals: { Buffer, process: { env: { AI_CREDENTIALS_ENCRYPTION_KEY: secret } } },
  });
}

function encryptLegacy(plaintext) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(SECRET).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString("base64url")).join(".");
}

const credentialScope = { purpose: "credentials", context: "ai-provider:user-1:CLAUDE" };

test("values round-trip in the v2 format", () => {
  const { encryptValue, decryptValue, isCurrentEncryptionFormat } = loadEncryption();
  const encrypted = encryptValue("sk-secret", credentialScope);

  assert.equal(isCurrentEncryptionFormat(encrypted), true);
  assert.equal(encrypted.split(".").length, 4);
  assert.doesNotMatch(encrypted, /sk-secret/);
  assert.equal(decryptValue(encrypted, credentialScope), "sk-secret");
});

test("a value cannot be decrypted under another context or purpose", () => {
  const { encryptValue, decryptValue } = loadEncryption();
  const encrypted = encryptValue("sk-secret", credentialScope);

  assert.throws(() => decryptValue(encrypted, { ...credentialScope, context: "ai-provider:user-2:CLAUDE" }));
  assert.throws(() => decryptValue(encrypted, { ...credentialScope, purpose: "content" }));
});

test("legacy credentials still decrypt, but only as credentials", () => {
  const { decryptValue } = loadEncryption();
  const legacy = encryptLegacy("sk-old");

  assert.equal(decryptValue(legacy, credentialScope), "sk-old");
  assert.throws(() => decryptValue(legacy, { purpose: "content", context: "mail.body" }));
});

test("a different master secret cannot decrypt", () => {
  const encrypted = loadEncryption().encryptValue("sk-secret", credentialScope);

  assert.throws(() => loadEncryption("another-secret").decryptValue(encrypted, credentialScope));
});
