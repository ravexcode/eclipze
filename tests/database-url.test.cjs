const assert = require("node:assert/strict");
const test = require("node:test");

const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const { isDatabaseUrlTlsEnforced } = loadTypeScript("src/utils/database-url.ts");

test("remote database URLs must set a TLS sslmode", () => {
  assert.equal(isDatabaseUrlTlsEnforced("postgresql://u:p@db.example.com:5432/app"), false);
  assert.equal(isDatabaseUrlTlsEnforced("postgresql://u:p@db.example.com:5432/app?sslmode=prefer"), false);
  assert.equal(isDatabaseUrlTlsEnforced("postgresql://u:p@db.example.com:5432/app?sslmode=require"), true);
  assert.equal(isDatabaseUrlTlsEnforced("postgresql://u:p@db.example.com:5432/app?sslmode=verify-full"), true);
});

test("local and unparsable database URLs are accepted", () => {
  assert.equal(isDatabaseUrlTlsEnforced("postgresql://u:p@localhost:5432/app"), true);
  assert.equal(isDatabaseUrlTlsEnforced("postgresql://u:p@127.0.0.1:5432/app"), true);
  assert.equal(isDatabaseUrlTlsEnforced("postgresql://u:p@db:5432/app"), true);
  assert.equal(isDatabaseUrlTlsEnforced("not a url"), true);
});
