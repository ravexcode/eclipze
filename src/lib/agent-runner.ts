import "server-only";

import { createHash } from "node:crypto";

// Commands a run may record as its command key. Repository access is currently read-only,
// so these commands are stored with the run but never executed.
export const ALLOWED_COMMANDS = {
  "git-status": { executable: "git", args: ["status", "--short"] },
  "git-diff-stat": { executable: "git", args: ["diff", "--stat"] },
  "git-rev-parse": { executable: "git", args: ["rev-parse", "--is-inside-work-tree"] },
  "pnpm-test": { executable: "pnpm", args: ["test"] },
  "pnpm-build": { executable: "pnpm", args: ["build"] },
  "pnpm-typecheck": { executable: "pnpm", args: ["typecheck"] },
  "npm-test": { executable: "npm", args: ["test"] },
  "npm-build": { executable: "npm", args: ["run", "build"] },
  "npm-typecheck": { executable: "npm", args: ["run", "typecheck"] },
  "pytest": { executable: "pytest", args: [] },
  "go-test": { executable: "go", args: ["test", "./..."] },
} as const;

export type AllowedCommand = keyof typeof ALLOWED_COMMANDS;

export type RunnerEvent = {
  type: "SYSTEM" | "COMMAND" | "OUTPUT" | "ERROR" | "RESULT" | "APPROVAL";
  message: string;
  metadata?: Record<string, unknown>;
};

export function createInstructionsDigest(instructions: string) {
  return createHash("sha256").update(instructions).digest("hex");
}

export function resolveAllowedCommand(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const command = value.trim() as AllowedCommand;
  return Object.hasOwn(ALLOWED_COMMANDS, command) ? { key: command, spec: ALLOWED_COMMANDS[command] } : null;
}

export function sanitizeRunnerOutput(value: string) {
  return value
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED_SECRET]")
    .replace(/gh[pousr]_[A-Za-z0-9_]{8,}/g, "[REDACTED_SECRET]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED_SECRET]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED_SECRET]");
}
