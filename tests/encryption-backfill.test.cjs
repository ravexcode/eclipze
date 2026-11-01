const assert = require("node:assert/strict");
const { createCipheriv, createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const SECRET = "test-encryption-secret";
process.env.AI_CREDENTIALS_ENCRYPTION_KEY = SECRET;

// scripts/ is git-ignored, so the backfill script only exists in local checkouts.
const BACKFILL_SCRIPT = path.resolve(__dirname, "../scripts/encrypt-existing-data.mjs");
const hasBackfillScript = fs.existsSync(BACKFILL_SCRIPT);
const backfill = hasBackfillScript ? require(BACKFILL_SCRIPT) : null;
const skip = hasBackfillScript ? false : "scripts/encrypt-existing-data.mjs is not present";

const appGlobals = { Buffer, process: { env: { AI_CREDENTIALS_ENCRYPTION_KEY: SECRET } } };
const encryption = loadTypeScript("src/lib/encryption.ts", { globals: appGlobals });
const contentEncryption = loadTypeScript("src/lib/content-encryption.ts", { globals: appGlobals });

function encryptLegacy(plaintext) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(SECRET).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString("base64url")).join(".");
}

test("content encrypted by the backfill script is readable by the app", { skip }, () => {
  const encrypted = backfill.encryptContent("Hello from before encryption", "mail.body");

  assert.equal(contentEncryption.decryptContent(encrypted, "mail.body"), "Hello from before encryption");

  const metadata = backfill.encryptContentJson({ code: "X" }, "agent-run-event.metadata");
  assert.deepEqual({ ...contentEncryption.decryptContentJson(metadata, "agent-run-event.metadata") }, { code: "X" });
});

test("credentials upgraded by the backfill script are readable by the app", { skip }, () => {
  const legacy = encryptLegacy("sk-legacy");
  const plaintext = backfill.decryptLegacyCredential(legacy);
  const scope = { purpose: "credentials", context: "ai-provider:user-1:CLAUDE" };
  const upgraded = backfill.encryptValue(plaintext, scope);

  assert.equal(encryption.isCurrentEncryptionFormat(upgraded), true);
  assert.equal(encryption.decryptValue(upgraded, scope), "sk-legacy");
});
