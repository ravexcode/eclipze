import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  OLLAMA_ALLOW_PRIVATE_NETWORK_ENV,
  OLLAMA_VALIDATION_TIMEOUT_MS,
} from "@/constants/ollama";
import {
  isLocalHostname,
  isPrivateNetworkAddress,
  isSameOllamaModel,
} from "@/utils/ollama";

export class OllamaRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OllamaRequestError";
    this.status = status;
  }
}

// Localhost and private networks are allowed only when the server itself runs locally,
// so a deployed server cannot be used to reach its own internal network (SSRF).
function allowsPrivateNetwork() {
  return process.env.NODE_ENV !== "production" ||
    process.env[OLLAMA_ALLOW_PRIVATE_NETWORK_ENV]?.trim() === "true";
}

// Checks the URL against the network rules right before each request, including the
// addresses its hostname resolves to now.
export async function assertOllamaUrlAllowed(baseUrl: string) {
  if (allowsPrivateNetwork()) {
    return;
  }

  const url = new URL(baseUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (url.protocol !== "https:") {
    throw new OllamaRequestError("Use an HTTPS URL for your Ollama server.", 400);
  }

  if (isLocalHostname(hostname)) {
    throw new OllamaRequestError(
      "This server cannot reach localhost or private network addresses. Use a public HTTPS URL for your Ollama server.",
      400,
    );
  }

  let addresses: string[];

  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const results = await lookup(hostname, { all: true, verbatim: true });
      addresses = results.map(result => result.address);
    } catch {
      throw new OllamaRequestError("The Ollama server hostname could not be resolved.", 400);
    }
  }

  if (addresses.length === 0 || addresses.some(address => isPrivateNetworkAddress(address))) {
    throw new OllamaRequestError(
      "This server cannot reach localhost or private network addresses. Use a public HTTPS URL for your Ollama server.",
      400,
    );
  }
}

export function getOllamaHeaders(apiKey: string) {
  const headers: Record<string, string> = {};

  // Ollama has no authentication of its own; a key is only sent to servers behind a proxy that requires one.
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

// Calls an Ollama endpoint. Redirects are refused so a public server cannot forward the
// request to an address the network rules would block.
export async function fetchOllama(input: {
  baseUrl: string;
  path: string;
  apiKey: string;
  timeoutMs: number;
  init?: RequestInit;
}) {
  await assertOllamaUrlAllowed(input.baseUrl);

  let response: Response;

  try {
    response = await fetch(`${input.baseUrl}${input.path}`, {
      ...input.init,
      headers: {
        ...getOllamaHeaders(input.apiKey),
        ...(input.init?.headers as Record<string, string> | undefined),
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch {
    throw new OllamaRequestError("Unable to reach your Ollama server. Check that it is running and reachable from Eclipze.", 503);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new OllamaRequestError("Your Ollama server redirected the request. Use the final server URL instead.", 400);
  }

  return response;
}

// Confirms the server answers as Ollama and has the requested model installed.
export async function validateOllamaConnection(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
}) {
  try {
    const response = await fetchOllama({
      baseUrl: input.baseUrl,
      path: "/api/tags",
      apiKey: input.apiKey,
      timeoutMs: OLLAMA_VALIDATION_TIMEOUT_MS,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false as const,
        status: 400,
        message: "Your Ollama server rejected the request. Check the API key required by its proxy.",
      };
    }

    if (!response.ok) {
      return {
        valid: false as const,
        status: 502,
        message: "The server did not respond like an Ollama server. Check the URL.",
      };
    }

    const payload = await response.json().catch(() => null) as {
      models?: Array<{ name?: unknown }>;
    } | null;

    if (!payload || !Array.isArray(payload.models)) {
      return {
        valid: false as const,
        status: 502,
        message: "The server did not respond like an Ollama server. Check the URL.",
      };
    }

    const installedModels = payload.models
      .map(model => model.name)
      .filter((name): name is string => typeof name === "string");

    if (!installedModels.some(name => isSameOllamaModel(name, input.model))) {
      const suggestions = installedModels.slice(0, 5).join(", ");

      return {
        valid: false as const,
        status: 400,
        message: suggestions
          ? `The model ${input.model} is not installed on your Ollama server. Installed models: ${suggestions}.`
          : `Your Ollama server has no models installed. Run "ollama pull ${input.model}" first.`,
      };
    }

    return { valid: true as const };
  } catch (error) {
    if (error instanceof OllamaRequestError) {
      return { valid: false as const, status: error.status, message: error.message };
    }

    return {
      valid: false as const,
      status: 503,
      message: "Unable to verify your Ollama server right now. Try again later.",
    };
  }
}
