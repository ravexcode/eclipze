import "server-only";

import { gunzip } from "node:zlib";
import { promisify } from "node:util";

import {
  SNAPSHOT_DOWNLOAD_TIMEOUT_MS,
  SNAPSHOT_MAX_ARCHIVE_BYTES,
  SNAPSHOT_MAX_EXTRACTED_BYTES,
  SNAPSHOT_MAX_FILE_BYTES,
  SNAPSHOT_MAX_LISTED_FILES,
  SNAPSHOT_USER_AGENT,
} from "@/constants/repository-snapshot";
import type { RepositorySnapshot, WorkspaceRepositoryProvider } from "@/types/agent-runner";
import {
  getRepositoryArchiveUrl,
  isRepositoryTextFile,
  readTarFiles,
} from "@/utils/repository-snapshot";

const gunzipAsync = promisify(gunzip);

type SnapshotResult =
  | { ok: true; snapshot: RepositorySnapshot }
  | { ok: false; code: string; message: string };

class SnapshotError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SnapshotError";
    this.code = code;
  }
}

// Reads the response body and stops as soon as it exceeds the size limit, so a large
// archive is never fully buffered.
async function readArchiveBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > SNAPSHOT_MAX_ARCHIVE_BYTES) {
    throw new SnapshotError("REPOSITORY_TOO_LARGE", "This repository is too large for agents to read.");
  }

  if (!response.body) {
    throw new SnapshotError("SNAPSHOT_FAILED", "The repository host returned an empty archive.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > SNAPSHOT_MAX_ARCHIVE_BYTES) {
      await reader.cancel();
      throw new SnapshotError("REPOSITORY_TOO_LARGE", "This repository is too large for agents to read.");
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

async function downloadArchive(archiveUrl: string) {
  let response: Response;

  try {
    response = await fetch(archiveUrl, {
      headers: { "User-Agent": SNAPSHOT_USER_AGENT },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(SNAPSHOT_DOWNLOAD_TIMEOUT_MS),
    });
  } catch {
    throw new SnapshotError("SNAPSHOT_FAILED", "Unable to reach the repository host. Try again in a moment.");
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new SnapshotError(
      "REPOSITORY_NOT_FOUND",
      "The repository or branch was not found. Agents can only read public repositories.",
    );
  }

  if (response.status === 429) {
    throw new SnapshotError("SNAPSHOT_RATE_LIMITED", "The repository host is limiting downloads. Try again in a minute.");
  }

  if (!response.ok) {
    throw new SnapshotError("SNAPSHOT_FAILED", "The repository host could not provide this branch right now.");
  }

  return readArchiveBody(response);
}

async function extractArchive(compressedArchive: Buffer) {
  try {
    return await gunzipAsync(compressedArchive, { maxOutputLength: SNAPSHOT_MAX_EXTRACTED_BYTES });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new SnapshotError("REPOSITORY_TOO_LARGE", "This repository is too large for agents to read.");
    }

    throw new SnapshotError("SNAPSHOT_FAILED", "The repository archive could not be read.");
  }
}

function buildSnapshot(archive: Uint8Array): RepositorySnapshot {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const textEntries = readTarFiles(archive)
    .filter(entry => isRepositoryTextFile(entry.path))
    .sort((left, right) => left.path.localeCompare(right.path))
    .slice(0, SNAPSHOT_MAX_LISTED_FILES);

  const files = new Map<string, string>();

  for (const entry of textEntries) {
    if (entry.data.byteLength > SNAPSHOT_MAX_FILE_BYTES) {
      continue;
    }

    try {
      const content = decoder.decode(entry.data);

      // Files with null bytes are binary even when their extension looks like text.
      if (!content.includes("\0")) {
        files.set(entry.path, content);
      }
    } catch {
      // Skip files that are not valid UTF-8.
    }
  }

  return {
    paths: textEntries.map(entry => entry.path),
    files,
  };
}

// Downloads a public repository branch as an archive and keeps its text files in memory.
// Nothing is written to disk and no git binary is needed.
export async function downloadRepositorySnapshot(input: {
  provider: WorkspaceRepositoryProvider;
  repositoryUrl: string;
  branch: string;
}): Promise<SnapshotResult> {
  const archiveUrl = getRepositoryArchiveUrl(input);

  if (archiveUrl.error !== undefined) {
    return { ok: false, code: "REPOSITORY_UNSUPPORTED", message: archiveUrl.error };
  }

  try {
    const compressedArchive = await downloadArchive(archiveUrl.value);
    const archive = await extractArchive(compressedArchive);

    return { ok: true, snapshot: buildSnapshot(archive) };
  } catch (error) {
    if (error instanceof SnapshotError) {
      return { ok: false, code: error.code, message: error.message };
    }

    return {
      ok: false,
      code: "SNAPSHOT_FAILED",
      message: error instanceof Error ? error.message : "The repository could not be read.",
    };
  }
}
