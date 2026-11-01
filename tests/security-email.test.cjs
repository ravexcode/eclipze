const assert = require("node:assert/strict");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

function loadSecurityEmail() {
  const sent = [];
  const scheduled = [];

  const module = loadTypeScript("src/lib/security-email.ts", {
    mocks: {
      "@/lib/auth": {
        getRequestIp: () => "203.0.113.7",
        describeDevice: () => "Desktop device · <script>",
      },
      "@/lib/email-delivery": {
        sendTransactionalEmail: async email => {
          sent.push(email);
        },
        sendEmailAfterResponse: (label, send) => {
          scheduled.push({ label, send });
        },
      },
    },
  });

  return { ...module, sent, scheduled };
}

test("security notice is scheduled after the response and escapes request details", async () => {
  const { notifySecurityEvent, sent, scheduled } = loadSecurityEmail();
  const request = new Request("https://example.com", { headers: { "user-agent": "test" } });

  notifySecurityEvent(request, { to: "user@example.com", kind: "PASSWORD_CHANGED" });

  assert.equal(sent.length, 0);
  assert.equal(scheduled.length, 1);

  await scheduled[0].send();

  assert.equal(sent[0].to, "user@example.com");
  assert.equal(sent[0].subject, "Your Eclipze password was changed");
  assert.match(sent[0].html, /203\.0\.113\.7/);
  assert.match(sent[0].html, /&lt;script&gt;/);
  assert.doesNotMatch(sent[0].html, /<script>/);
  assert.match(sent[0].text, /reset your password immediately/);
});
