import type { Prisma } from "@prisma/client";

// Columns needed by run lists. Large columns (changePatch, skillSnapshot) are left out
// because list views only show the prompt, status, and date of each run.
export const AGENT_RUN_SUMMARY_SELECT = {
  id: true,
  agentSessionId: true,
  repositoryId: true,
  status: true,
  model: true,
  provider: true,
  prompt: true,
  errorCode: true,
  resultSummary: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AgentRunSelect;

export const AGENT_RUN_LIST_LIMIT = 50;
