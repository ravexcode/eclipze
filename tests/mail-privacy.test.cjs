const assert = require("node:assert/strict");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const { maskEmail, serializeMailUser, updateMailForm } = loadTypeScript("src/utils/mail.ts");

test("maskEmail hides most of the local part and keeps the domain", () => {
  assert.equal(maskEmail("rafael@example.com"), "ra•••@example.com");
  assert.equal(maskEmail("ana@example.com"), "a•••@example.com");
  assert.equal(maskEmail("invalid"), "•••");
});

test("serializeMailUser never returns the full email", () => {
  const user = serializeMailUser({ id: "user-1", username: null, email: "rafael@example.com" });

  assert.deepEqual({ ...user }, { id: "user-1", username: null, emailHint: "ra•••@example.com" });
  assert.equal("email" in user, false);
});

test("editing the recipient drops the reply target", () => {
  const reply = { to: "ra•••@example.com", recipientId: "user-1", subject: "Re: hi", body: "" };

  assert.equal(updateMailForm(reply, { body: "Thanks" }).recipientId, "user-1");
  assert.equal(updateMailForm(reply, { to: "someone" }).recipientId, undefined);
});
