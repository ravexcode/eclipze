export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";

export const OLLAMA_MAX_BASE_URL_LENGTH = 500;

export const OLLAMA_VALIDATION_TIMEOUT_MS = 10_000;

// Self-hosted models can be much slower than hosted APIs, so chat requests wait longer.
export const OLLAMA_CHAT_TIMEOUT_MS = 120_000;

export const OLLAMA_MAX_OUTPUT_TOKENS = 4_096;

// Allows Ollama URLs on localhost and private networks outside development, for a
// production build that runs on the same machine or network as the Ollama server.
export const OLLAMA_ALLOW_PRIVATE_NETWORK_ENV = "OLLAMA_ALLOW_PRIVATE_NETWORK";
