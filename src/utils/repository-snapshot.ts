import {
  SNAPSHOT_IGNORED_DIRECTORIES,
  SNAPSHOT_REPOSITORY_SEGMENT_PATTERN,
  SNAPSHOT_TEXT_EXTENSIONS,
} from "@/constants/repository-snapshot";
import type { WorkspaceRepositoryProvider } from "@/types/agent-runner";

const TAR_BLOCK_SIZE = 512;

export type TarFileEntry = {
  path: string;
  data: Uint8Array;
};

// Archive URLs

function readRepositorySegments(repositoryUrl: string) {
  const url = new URL(repositoryUrl);
  // GitLab puts extra pages after "/-/", such as /group/repo/-/tree/main.
  const repositoryPath = url.pathname.split("/-/")[0];

  const segments = repositoryPath
    .split("/")
    .filter(Boolean)
    .map(segment => segment.replace(/\.git$/, ""));

  return {
    hostname: url.hostname.toLowerCase().replace(/^www\./, ""),
    segments,
  };
}

function hasSafeSegments(segments: string[]) {
  return segments.every(segment => {
    return SNAPSHOT_REPOSITORY_SEGMENT_PATTERN.test(segment) && segment !== "." && segment !== "..";
  });
}

// Builds the public archive URL for a repository branch. The host is always fixed by the
// provider, so a repository URL cannot point the download at another server.
export function getRepositoryArchiveUrl(input: {
  provider: WorkspaceRepositoryProvider;
  repositoryUrl: string;
  branch: string;
}) {
  const { hostname, segments } = readRepositorySegments(input.repositoryUrl);
  const encodedBranch = input.branch
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  if (input.provider === "GITHUB") {
    const [owner, repository] = segments;

    if (hostname !== "github.com" || !owner || !repository || !hasSafeSegments([owner, repository])) {
      return { error: "Use a GitHub repository URL like https://github.com/owner/repository." } as const;
    }

    return {
      value: `https://codeload.github.com/${owner}/${repository}/tar.gz/refs/heads/${encodedBranch}`,
    } as const;
  }

  if (input.provider === "GITLAB") {
    if (hostname !== "gitlab.com" || segments.length < 2 || !hasSafeSegments(segments)) {
      return { error: "Use a GitLab repository URL like https://gitlab.com/group/repository." } as const;
    }

    const projectId = encodeURIComponent(segments.join("/"));

    return {
      value: `https://gitlab.com/api/v4/projects/${projectId}/repository/archive.tar.gz?sha=${encodeURIComponent(input.branch)}`,
    } as const;
  }

  if (input.provider === "BITBUCKET") {
    const [owner, repository] = segments;

    if (hostname !== "bitbucket.org" || !owner || !repository || !hasSafeSegments([owner, repository])) {
      return { error: "Use a Bitbucket repository URL like https://bitbucket.org/owner/repository." } as const;
    }

    return {
      value: `https://bitbucket.org/${owner}/${repository}/get/${encodeURIComponent(input.branch)}.tar.gz`,
    } as const;
  }

  return { error: "Agents can read repositories from GitHub, GitLab, or Bitbucket." } as const;
}

// Repository paths

export function isSensitiveRepositoryPath(filePath: string) {
  const parts = filePath.toLowerCase().split(/[\\/]/);
  const fileName = parts.at(-1) ?? "";

  const isInBlockedDirectory = parts.some(part => {
    return [".git", ".next", "node_modules", "vendor"].includes(part);
  });

  return isInBlockedDirectory ||
    fileName.startsWith(".env") ||
    fileName === ".npmrc" ||
    fileName === ".pypirc" ||
    fileName.includes("credentials") ||
    fileName.includes("private-key") ||
    fileName.endsWith(".pem") ||
    fileName.endsWith(".key");
}

export function isRepositoryTextFile(filePath: string) {
  const parts = filePath.split("/");
  const fileName = parts.at(-1) ?? "";
  const extensionIndex = fileName.lastIndexOf(".");
  const extension = extensionIndex > 0 ? fileName.slice(extensionIndex).toLowerCase() : "";

  const isInIgnoredDirectory = parts.slice(0, -1).some(part => SNAPSHOT_IGNORED_DIRECTORIES.has(part));

  return !isInIgnoredDirectory &&
    !isSensitiveRepositoryPath(filePath) &&
    SNAPSHOT_TEXT_EXTENSIONS.has(extension);
}

// Turns a path requested by the agent into the snapshot's relative form, or null when it
// tries to leave the repository.
export function normalizeRequestedRepositoryPath(value: string) {
  if (!value || value.includes("\\") || value.includes("\0")) {
    return null;
  }

  const parts = value
    .replace(/^\/+/, "")
    .split("/")
    .filter(part => part !== "" && part !== ".");

  if (parts.length === 0 || parts.includes("..")) {
    return null;
  }

  return parts.join("/");
}

// Archives wrap every file in one top-level folder, such as repository-main/. This drops
// that folder and rejects paths that try to leave the repository.
function stripArchiveRoot(archivePath: string) {
  const parts = archivePath.split("/").filter(Boolean);

  if (parts.length < 2 || parts.some(part => part === "." || part === "..")) {
    return null;
  }

  return parts.slice(1).join("/");
}

// Tar parsing

function readTarString(block: Uint8Array, start: number, length: number) {
  const field = block.subarray(start, start + length);
  const end = field.indexOf(0);

  return new TextDecoder().decode(end === -1 ? field : field.subarray(0, end));
}

function readTarSize(block: Uint8Array) {
  // Sizes are octal text. Base-256 sizes are only used for files over 8 GB.
  if ((block[124] & 0x80) !== 0) {
    return null;
  }

  const size = Number.parseInt(readTarString(block, 124, 12).trim() || "0", 8);

  return Number.isFinite(size) && size >= 0 ? size : null;
}

function isEmptyBlock(block: Uint8Array) {
  return block.every(byte => byte === 0);
}

// Reads the "path" record from a PAX extended header: "<length> path=<value>\n".
function readPaxPath(data: Uint8Array) {
  const records = new TextDecoder().decode(data).split("\n");

  for (const record of records) {
    const match = record.match(/^\d+ path=(.*)$/);

    if (match) {
      return match[1];
    }
  }

  return null;
}

// Reads regular files from an uncompressed tar archive. Links, devices, and directories
// are skipped, so the snapshot only contains plain file contents.
export function readTarFiles(archive: Uint8Array) {
  const files: TarFileEntry[] = [];
  let offset = 0;
  let nextEntryPath: string | null = null;

  while (offset + TAR_BLOCK_SIZE <= archive.byteLength) {
    const header = archive.subarray(offset, offset + TAR_BLOCK_SIZE);

    if (isEmptyBlock(header)) {
      break;
    }

    const size = readTarSize(header);

    if (size === null) {
      throw new Error("The repository archive contains an unsupported entry.");
    }

    const dataStart = offset + TAR_BLOCK_SIZE;
    const dataEnd = dataStart + size;

    if (dataEnd > archive.byteLength) {
      throw new Error("The repository archive is incomplete.");
    }

    const data = archive.subarray(dataStart, dataEnd);
    const typeFlag = String.fromCharCode(header[156] || 48);

    if (typeFlag === "x") {
      // PAX header for the next entry, used for paths longer than 100 characters.
      nextEntryPath = readPaxPath(data);
    } else if (typeFlag === "L") {
      // GNU long name for the next entry.
      nextEntryPath = new TextDecoder().decode(data).replace(/\0+$/, "");
    } else {
      if (typeFlag === "0") {
        const name = readTarString(header, 0, 100);
        const prefix = readTarString(header, 345, 155);
        const archivePath = nextEntryPath ?? (prefix ? `${prefix}/${name}` : name);
        const path = stripArchiveRoot(archivePath);

        if (path) {
          files.push({ path, data });
        }
      }

      nextEntryPath = null;
    }

    offset = dataStart + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
  }

  return files;
}
