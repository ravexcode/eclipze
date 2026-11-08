const assert = require("node:assert/strict");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const {
  decryptContent,
  decryptContentJson,
  decryptOptionalContent,
  encryptContent,
  encryptContentJson,
} = loadTypeScript("src/lib/content-encryption.ts", {
  globals: {
    Buffer,
    process: { env: { AI_CREDENTIALS_ENCRYPTION_KEY: "test-encryption-secret" } },
  },
});

test("text content round-trips and is not stored in plaintext", () => {
  const encrypted = encryptContent("Quarterly numbers attached", "mail.body");

  assert.match(encrypted, /^enc:v2\./);
  assert.doesNotMatch(encrypted, /Quarterly/);
  assert.equal(decryptContent(encrypted, "mail.body"), "Quarterly numbers attached");
});

test("plaintext written before encryption is returned unchanged", () => {
  assert.equal(decryptContent("Legacy message", "mail.body"), "Legacy message");
  assert.equal(decryptContent("enc: looks encrypted but is not", "mail.body"), "enc: looks encrypted but is not");
  assert.equal(decryptOptionalContent(null, "agent-run.prompt"), null);
});

test("content encrypted for one field is not readable as another", () => {
  const encrypted = encryptContent("subject line", "mail.subject");

  assert.equal(decryptContent(encrypted, "mail.body"), encrypted);
});

test("JSON content round-trips and plain JSON is left alone", () => {
  const encrypted = encryptContentJson({ code: "SNAPSHOT_FAILED", files: 3 }, "agent-run-event.metadata");

  assert.deepEqual(Object.keys(encrypted), ["$encrypted"]);
  assert.deepEqual(
    { ...decryptContentJson(encrypted, "agent-run-event.metadata") },
    { code: "SNAPSHOT_FAILED", files: 3 },
  );
  assert.equal(encryptContentJson(undefined, "agent-run-event.metadata"), undefined);

  const legacy = { isFinalAnswer: true };
  assert.equal(decryptContentJson(legacy, "agent-run-event.metadata"), legacy);
});
