// Encrypts rows written before content encryption and upgrades legacy credentials to the
// v2 format with owner-bound contexts.
//
//   pnpm security:encrypt-data           dry run: counts the rows that would change
//   pnpm security:encrypt-data --apply   writes the encrypted values
//
// The app reads both old and new values, so this can run at any time after deploy and can
// be stopped and restarted safely. Each update only applies if the row still holds the
// value that was read, so concurrent edits are never overwritten.
//
// The format must match src/lib/encryption.ts and src/lib/content-encryption.ts;
// tests/encryption-backfill.test.cjs checks that both produce compatible values.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

const ENCRYPTION_KEY_ENV = "AI_CREDENTIALS_ENCRYPTION_KEY";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const CURRENT_ENCRYPTION_VERSION = "v2";
const ENCRYPTION_KEY_SALT = "eclipze-encryption";
const CONTENT_ENCRYPTION_PREFIX = "enc:";
const ENCRYPTED_JSON_KEY = "$encrypted";
const BATCH_SIZE = 200;

function getMasterSecret() {
  const secret = process.env[ENCRYPTION_KEY_ENV];

  if (!secret) {
    throw new Error(`${ENCRYPTION_KEY_ENV} is not configured.`);
  }

  return secret;
}

function getPurposeKey(purpose) {
  const derivedKey = hkdfSync(
    "sha256",
    getMasterSecret(),
    ENCRYPTION_KEY_SALT,
    `${purpose}:${CURRENT_ENCRYPTION_VERSION}`,
    32,
  );

  return Buffer.from(derivedKey);
}

export function encryptValue(plaintext, scope) {
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

export function decryptLegacyCredential(value) {
  const [iv, authTag, ciphertext] = value.split(".");
  const key = createHash("sha256").update(getMasterSecret()).digest();
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(iv, "base64url"));

  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptContent(value, field) {
  return `${CONTENT_ENCRYPTION_PREFIX}${encryptValue(value, { purpose: "content", context: field })}`;
}

export function encryptContentJson(value, field) {
  return { [ENCRYPTED_JSON_KEY]: encryptContent(JSON.stringify(value), field) };
}

function isEncryptedJson(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof value[ENCRYPTED_JSON_KEY] === "string";
}

function isLegacyCredential(value) {
  return value.split(".").length === 3;
}

// Reads rows in id order, BATCH_SIZE at a time, and hands each batch to `handle`.
async function forEachBatch(delegate, select, handle) {
  let lastId = null;

  for (;;) {
    const rows = await delegate.findMany({
      where: lastId ? { id: { gt: lastId } } : {},
      select: { id: true, ...select },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });

    if (rows.length === 0) {
      return;
    }

    lastId = rows[rows.length - 1].id;
    await handle(rows);
  }
}

async function encryptTextColumn(prisma, task, apply) {
  const delegate = prisma[task.model];
  let changed = 0;

  await forEachBatch(delegate, { [task.column]: true }, async rows => {
    for (const row of rows) {
      const value = row[task.column];

      if (typeof value !== "string" || value.startsWith(CONTENT_ENCRYPTION_PREFIX)) {
        continue;
      }

      changed += 1;

      if (apply) {
        await delegate.updateMany({
          where: { id: row.id, [task.column]: value },
          data: { [task.column]: encryptContent(value, task.field) },
        });
      }
    }
  });

  return changed;
}

async function encryptEventMetadata(prisma, apply) {
  let changed = 0;

  await forEachBatch(prisma.agentRunEvent, { metadata: true }, async rows => {
    for (const row of rows) {
      if (row.metadata === null || isEncryptedJson(row.metadata)) {
        continue;
      }

      changed += 1;

      if (apply) {
        // Json columns cannot be compared in a where clause, so this update is unconditional.
        // Event metadata is written once and never edited, so there is nothing to overwrite.
        await prisma.agentRunEvent.update({
          where: { id: row.id },
          data: { metadata: encryptContentJson(row.metadata, "agent-run-event.metadata") },
        });
      }
    }
  });

  return changed;
}

async function upgradeCredentialColumn(prisma, task, apply) {
  const delegate = prisma[task.model];
  let changed = 0;
  let failed = 0;

  await forEachBatch(delegate, { [task.column]: true, ...task.contextSelect }, async rows => {
    for (const row of rows) {
      const value = row[task.column];

      if (typeof value !== "string" || !isLegacyCredential(value)) {
        continue;
      }

      let plaintext;

      try {
        plaintext = decryptLegacyCredential(value);
      } catch {
        failed += 1;
        continue;
      }

      changed += 1;

      if (apply) {
        await delegate.updateMany({
          where: { id: row.id, [task.column]: value },
          data: {
            [task.column]: encryptValue(plaintext, {
              purpose: "credentials",
              context: task.getContext(row),
            }),
          },
        });
      }
    }
  });

  return { changed, failed };
}

const TEXT_TASKS = [
  { label: "Mail subjects", model: "mail", column: "subject", field: "mail.subject" },
  { label: "Mail bodies", model: "mail", column: "body", field: "mail.body" },
  { label: "Issue messages", model: "issueMessage", column: "body", field: "issue-message.body" },
  { label: "Agent run prompts", model: "agentRun", column: "prompt", field: "agent-run.prompt" },
  { label: "Agent run event messages", model: "agentRunEvent", column: "message", field: "agent-run-event.message" },
];

const CREDENTIAL_TASKS = [
  {
    label: "AI provider keys",
    model: "aiProviderConnection",
    column: "encryptedApiKey",
    contextSelect: { userId: true, provider: true },
    getContext: row => `ai-provider:${row.userId}:${row.provider}`,
  },
  {
    label: "MCP tokens",
    model: "mcpConnection",
    column: "encryptedToken",
    contextSelect: { userId: true },
    getContext: row => `mcp-connection:${row.userId}`,
  },
  {
    label: "Database credentials",
    model: "databaseConnection",
    column: "encryptedCredential",
    contextSelect: { userId: true, provider: true },
    getContext: row => `database-connection:${row.userId}:${row.provider}`,
  },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const verb = apply ? "encrypted" : "would be encrypted";

  getMasterSecret();

  const prisma = new PrismaClient();

  try {
    console.log(apply ? "Encrypting existing data..." : "Dry run. Pass --apply to write changes.");

    for (const task of TEXT_TASKS) {
      const changed = await encryptTextColumn(prisma, task, apply);
      console.log(`${task.label}: ${changed} ${verb}`);
    }

    const metadataChanged = await encryptEventMetadata(prisma, apply);
    console.log(`Agent run event metadata: ${metadataChanged} ${verb}`);

    for (const task of CREDENTIAL_TASKS) {
      const { changed, failed } = await upgradeCredentialColumn(prisma, task, apply);
      const failure = failed ? `, ${failed} could not be decrypted and were skipped` : "";
      console.log(`${task.label}: ${changed} ${apply ? "upgraded" : "would be upgraded"} to v2${failure}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
