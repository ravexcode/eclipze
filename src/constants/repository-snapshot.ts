// Repository snapshots are public repository archives downloaded over HTTPS and kept in
// memory, so agents can read a repository without git or a writable disk.

export const SNAPSHOT_DOWNLOAD_TIMEOUT_MS = 30_000;

// Compressed archive size accepted from the repository host.
export const SNAPSHOT_MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

// Uncompressed tar size. Larger repositories are rejected instead of partially read.
export const SNAPSHOT_MAX_EXTRACTED_BYTES = 150 * 1024 * 1024;

// Text files larger than this stay in the file tree but their content is not kept.
export const SNAPSHOT_MAX_FILE_BYTES = 8_000;

export const SNAPSHOT_MAX_LISTED_FILES = 2_000;

export const SNAPSHOT_USER_AGENT = "Eclipze-Agent";

export const SNAPSHOT_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "vendor",
]);

export const SNAPSHOT_TEXT_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".css",
  ".dart",
  ".go",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mjs",
  ".py",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

// Path segments that only contain these characters are accepted in archive URLs.
export const SNAPSHOT_REPOSITORY_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
