import "server-only";

import { generateAgentResponse } from "@/lib/agent-completion";
import { releaseAiCreditReservation, settleAiCreditReservation } from "@/lib/ai-credits";
import { Prisma } from "@prisma/client";
import type { AgentProvider } from "@/types/ai";
import type { AgentPermissionMode, AgentRunEventType } from "@/types/agent-runner";
import { DEFAULT_AGENT_PERMISSION_MODE } from "@/constants/agents";
import { AGENT_RUN_SUMMARY_SELECT } from "@/constants/agent-runs";
import prisma from "@/lib/prisma";
import { appendRunEventTransaction } from "@/lib/agent-run-events";
import {
  decryptContent,
  decryptContentJson,
  decryptOptionalContent,
} from "@/lib/content-encryption";
import { sanitizeRunnerOutput, type RunnerEvent } from "@/lib/agent-runner";
import { downloadRepositorySnapshot } from "@/lib/repository-snapshot";
import type { WorkspaceRepositoryProvider } from "@/types/agent-runner";

type RunWithRelations = {
  id: string;
  agentSessionId: string | null;
  repositoryId: string;
  status: string;
  permissionMode: string;
  creditReservation: number;
  model: string;
  provider: string;
  mcpConnectionId: string | null;
  prompt: string | null;
  commandKey: string;
  instructionsDigest: string;
  skillSnapshot: unknown;
  workspaceKey: string;
  errorCode: string | null;
  resultSummary: string | null;
  changePatch: string | null;
  cancelRequestedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  events?: Array<{
    id: string;
    runId: string;
    sequence: number;
    type: string;
    message: string;
    metadata: unknown;
    createdAt: Date;
  }>;
};

function iso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function serializeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

type RunSummary = Prisma.AgentRunGetPayload<{ select: typeof AGENT_RUN_SUMMARY_SELECT }>;

// The snapshot keeps full skill content for the runner. Clients only need to know which
// skills were used, so the content is not sent on every run poll.
function serializeSkillSnapshot(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(skill => {
    const entry = skill && typeof skill === "object"
      ? skill as Record<string, unknown>
      : {};

    return {
      id: typeof entry.id === "string" ? entry.id : null,
      slug: typeof entry.slug === "string" ? entry.slug : "",
      name: typeof entry.name === "string" ? entry.name : "",
      version: typeof entry.version === "string" ? entry.version : "",
    };
  });
}

export function serializeAgentRunSummary(run: RunSummary) {
  return {
    id: run.id,
    agentSessionId: run.agentSessionId,
    repositoryId: run.repositoryId,
    status: run.status,
    model: run.model,
    provider: run.provider,
    prompt: decryptOptionalContent(run.prompt, "agent-run.prompt"),
    errorCode: run.errorCode,
    resultSummary: run.resultSummary,
    startedAt: iso(run.startedAt),
    finishedAt: iso(run.finishedAt),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export function serializeAgentRun(run: RunWithRelations) {
  const skillSnapshot = serializeSkillSnapshot(run.skillSnapshot);

  return {
    id: run.id,
    agentSessionId: run.agentSessionId,
    repositoryId: run.repositoryId,
    status: run.status,
    permissionMode: run.permissionMode,
    creditReservation: run.creditReservation,
    model: run.model,
    provider: run.provider,
    prompt: decryptOptionalContent(run.prompt, "agent-run.prompt"),
    commandKey: run.commandKey,
    instructionsDigest: run.instructionsDigest,
    skills: skillSnapshot,
    workspaceKey: run.workspaceKey,
    errorCode: run.errorCode,
    resultSummary: run.resultSummary,
    changePatch: run.changePatch,
    cancelRequestedAt: iso(run.cancelRequestedAt),
    startedAt: iso(run.startedAt),
    finishedAt: iso(run.finishedAt),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    events: run.events?.map(event => ({
      id: event.id,
      runId: event.runId,
      sequence: event.sequence,
      type: event.type,
      message: decryptContent(event.message, "agent-run-event.message"),
      metadata: serializeMetadata(decryptContentJson(event.metadata, "agent-run-event.metadata")),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function appendRunEvent(runId: string, event: RunnerEvent) {
  return appendRunEventTransaction(prisma, runId, {
    type: event.type as AgentRunEventType,
    message: event.message,
    metadata: event.metadata
      ? structuredClone(event.metadata) as Prisma.InputJsonValue
      : undefined,
  });
}

async function updateRunFailure(runId: string, errorCode: string, resultSummary: string, status: "FAILED" | "BLOCKED" = "FAILED") {
  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status,
      errorCode,
      resultSummary,
      finishedAt: new Date(),
    },
  });
}

async function executeAgentRun(runId: string, userId: string) {
  const run = await prisma.agentRun.findFirst({
    where: { id: runId, userId },
    include: { repository: true },
  });

  if (!run) {
    return;
  }

  let creditsSettled = false;
  let eventQueue = Promise.resolve();
  const persistEvent = (event: RunnerEvent) => {
    eventQueue = eventQueue.then(() => appendRunEvent(run.id, event)).then(() => undefined);
    return eventQueue;
  };

  try {
    const currentRun = await prisma.agentRun.findUnique({
      where: { id: run.id },
      select: { status: true, cancelRequestedAt: true },
    });

    if (!currentRun || currentRun.status === "CANCELLED" || currentRun.cancelRequestedAt) {
      return;
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
    await persistEvent({ type: "SYSTEM", message: "Run started." });

    await persistEvent({
      type: "SYSTEM",
      message: `Downloading a read-only snapshot of ${run.repository.repositoryUrl} (${run.repository.defaultBranch}).`,
    });

    const snapshotResult = await downloadRepositorySnapshot({
      provider: run.repository.provider as WorkspaceRepositoryProvider,
      repositoryUrl: run.repository.repositoryUrl,
      branch: run.repository.defaultBranch,
    });

    if (!snapshotResult.ok) {
      await persistEvent({
        type: "ERROR",
        message: snapshotResult.message,
        metadata: { code: snapshotResult.code },
      });
      await updateRunFailure(run.id, snapshotResult.code, snapshotResult.message);
      await eventQueue;
      return;
    }

    const repositorySnapshot = snapshotResult.snapshot;

    await persistEvent({
      type: "SYSTEM",
      message: `Repository ready: ${repositorySnapshot.paths.length} text files, read-only.`,
    });

    const cancelled = await prisma.agentRun.findUnique({
      where: { id: run.id },
      select: { cancelRequestedAt: true, status: true },
    });

    if (!cancelled || cancelled.status === "CANCELLED" || cancelled.cancelRequestedAt) {
      await persistEvent({ type: "SYSTEM", message: "Run cancelled after the repository download." });
      await eventQueue;
      return;
    }

    const prompt = decryptOptionalContent(run.prompt, "agent-run.prompt");

    if (!prompt) {
      await persistEvent({ type: "ERROR", message: "This task does not include a prompt." });
      await updateRunFailure(run.id, "PROMPT_MISSING", "This task does not include a prompt.");
      await eventQueue;
      return;
    }

    const completion = await generateAgentResponse({
      userId,
      provider: run.provider as AgentProvider,
      mcpConnectionId: run.mcpConnectionId,
      model: run.model,
      permissionMode: run.permissionMode === "ASK"
        ? DEFAULT_AGENT_PERMISSION_MODE
        : run.permissionMode as AgentPermissionMode,
      prompt,
      repositorySnapshot,
      repositoryUrl: run.repository.repositoryUrl,
      defaultBranch: run.repository.defaultBranch,
      skillSnapshot: run.skillSnapshot,
      isCancelled: async () => {
        const current = await prisma.agentRun.findUnique({
          where: { id: run.id },
          select: { status: true, cancelRequestedAt: true },
        });
        return !current || current.status === "CANCELLED" || Boolean(current.cancelRequestedAt);
      },
      onEvent: persistEvent,
    });

    if (run.creditReservation > 0) {
      if (completion.costUsd === null) {
        throw new Error("OpenRouter did not return task cost. Reserved credits were released.");
      }
      const spentCredits = await settleAiCreditReservation({
        userId,
        runId: run.id,
        reservedCredits: run.creditReservation,
        costUsd: completion.costUsd,
      });
      creditsSettled = true;
      await persistEvent({
        type: "SYSTEM",
        message: `Usage: $${completion.costUsd.toFixed(6)} USD · ${spentCredits} credits.`,
        metadata: {
          costUsd: completion.costUsd,
          credits: spentCredits,
          inputTokens: completion.usage.inputTokens ?? 0,
          outputTokens: completion.usage.outputTokens ?? 0,
        },
      });
    }

    const completionRun = await prisma.agentRun.findUnique({
      where: { id: run.id },
      select: { status: true, cancelRequestedAt: true },
    });

    if (!completionRun || completionRun.status === "CANCELLED" || completionRun.cancelRequestedAt) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "CANCELLED",
          errorCode: "CANCELLED",
          resultSummary: null,
          finishedAt: new Date(),
        },
      });
      await persistEvent({ type: "SYSTEM", message: "Run cancelled." });
      await eventQueue;
      return;
    }

    for (let offset = 0; offset < completion.answer.length; offset += 7_500) {
      await persistEvent({
        type: "OUTPUT",
        message: sanitizeRunnerOutput(completion.answer.slice(offset, offset + 7_500)),
        metadata: { isFinalAnswer: true },
      });
    }

    const resultSummary = sanitizeRunnerOutput(completion.answer).slice(0, 500);
    await persistEvent({ type: "RESULT", message: "Task completed." });

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        errorCode: null,
        resultSummary,
        finishedAt: new Date(),
      },
    });
    await eventQueue;
  } catch (error) {
    const message = sanitizeRunnerOutput(error instanceof Error ? error.message : "Runner failed unexpectedly.");
    const cancellation = await prisma.agentRun.findUnique({
      where: { id: run.id },
      select: { status: true, cancelRequestedAt: true },
    }).catch(() => null);
    if (cancellation?.status === "CANCELLED" || cancellation?.cancelRequestedAt) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "CANCELLED",
          errorCode: "CANCELLED",
          finishedAt: new Date(),
        },
      });
      await persistEvent({ type: "SYSTEM", message: "Run cancelled." });
      await eventQueue;
      return;
    }
    await persistEvent({ type: "ERROR", message: "Runner failed unexpectedly." });
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorCode: "RUNNER_ERROR",
        resultSummary: message.slice(0, 500),
        finishedAt: new Date(),
      },
    });
    await eventQueue;
  } finally {
    if (run.creditReservation > 0 && !creditsSettled) {
      await releaseAiCreditReservation({ userId, runId: run.id, reservedCredits: run.creditReservation }).catch(() => undefined);
    }
  }
}

// Returns the run's promise so the route can keep the function alive with after().
export function startAgentRun(runId: string, userId: string) {
  return executeAgentRun(runId, userId).catch(async () => {
    await updateRunFailure(runId, "RUNNER_ERROR", "Runner could not start.").catch(() => undefined);
  });
}

export async function cancelAgentRun(runId: string, userId: string) {
  const run = await prisma.agentRun.findFirst({ where: { id: runId, userId } });

  if (!run) {
    return null;
  }

  if (run.status === "QUEUED") {
    const cancelled = await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "CANCELLED", cancelRequestedAt: new Date(), finishedAt: new Date(), errorCode: "CANCELLED" },
    });
    await appendRunEvent(run.id, { type: "SYSTEM", message: "Run cancelled before start." });
    return cancelled;
  }

  if (run.status === "RUNNING" || run.status === "WAITING_FOR_APPROVAL") {
    // update() returns the updated row, so a second read is not needed.
    return prisma.agentRun.update({
      where: { id: run.id },
      data: { cancelRequestedAt: new Date() },
    });
  }

  return run;
}
