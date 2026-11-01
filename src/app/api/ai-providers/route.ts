import { NextResponse } from "next/server";

import { decryptApiKey, encryptApiKey } from "@/lib/ai-credentials";
import { getCurrentUser } from "@/lib/auth";
import { isServiceOpenRouterAvailable } from "@/lib/openrouter";
import prisma from "@/lib/prisma";
import { AI_PROVIDERS, isAiProvider, type AiProvider } from "@/types/ai";
import { activateProviderAgent, deactivateProviderAgent, isExternalAgentProvider } from "@/lib/agent-provider-sync";
import { validateProviderApiKey } from "@/lib/ai-provider-validation";
import { validateOllamaConnection } from "@/lib/ollama";
import { normalizeOllamaBaseUrl } from "@/utils/ollama";
import { getAiProviderCredentialContext } from "@/utils/ai-credentials";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

const PROVIDER_LABELS: Record<AiProvider, string> = {
  CLAUDE: "Claude",
  GPT: "OpenAI",
  OPENROUTER: "OpenRouter",
  ZAI: "Z.Ai",
  XAI: "xAI",
  CURSOR: "Cursor",
  OLLAMA: "Ollama",
};

async function validateOpenAiApiKey(apiKey: string) {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) return { valid: true as const };

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false as const,
        status: 400,
        message: "OpenAI rejected this API key. Check the key and try again.",
      };
    }

    return {
      valid: false as const,
      status: 502,
      message: "OpenAI could not verify the API key right now. Try again later.",
    };
  } catch {
    return {
      valid: false as const,
      status: 503,
      message: "Unable to reach OpenAI to verify the API key. Try again later.",
    };
  }
}

async function validateOpenRouterApiKey(apiKey: string) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) return { valid: true as const };

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false as const,
        status: 400,
        message: "OpenRouter rejected this API key. Check the key and try again.",
      };
    }

    return {
      valid: false as const,
      status: 502,
      message: "OpenRouter could not verify the API key right now. Try again later.",
    };
  } catch {
    return {
      valid: false as const,
      status: 503,
      message: "Unable to reach OpenRouter to verify the API key. Try again later.",
    };
  }
}

function serializeConnection(connection: {
  provider: AiProvider;
  keyHint: string | null;
  model: string | null;
  baseUrl?: string | null;
  updatedAt: Date;
}) {
  return {
    provider: connection.provider,
    connected: true,
    keyHint: connection.keyHint,
    model: connection.model,
    baseUrl: connection.baseUrl ?? null,
    updatedAt: connection.updatedAt.toISOString(),
  };
}

function encryptionUnavailableResponse() {
  return NextResponse.json(
    { message: "AI provider storage is not configured. Add AI_CREDENTIALS_ENCRYPTION_KEY." },
    { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
  );
}

// Ollama connects by server URL and model. The API key is optional, for servers behind a
// proxy that requires one. Nothing is saved until the server and model are verified.
async function connectOllama(userId: string, body: Record<string, unknown>, model: string) {
  const baseUrl = normalizeOllamaBaseUrl(body.baseUrl);

  if (baseUrl.error !== undefined) {
    return NextResponse.json({ message: baseUrl.error }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }

  if (!model) {
    return NextResponse.json(
      { message: "Enter the name of a model installed on your Ollama server, such as llama3.1." },
      { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  const newApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  if (newApiKey.length > 500) {
    return NextResponse.json({ message: "API key is too long." }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const existingConnection = await prisma.aiProviderConnection.findUnique({
    where: { userId_provider: { userId, provider: "OLLAMA" } },
    select: { baseUrl: true, encryptedApiKey: true, keyHint: true },
  });

  // A saved key is kept only for the same server, so it is never sent to a new URL.
  const keepsSavedKey = !newApiKey &&
    Boolean(existingConnection?.encryptedApiKey) &&
    existingConnection?.baseUrl === baseUrl.value;

  let apiKey = newApiKey;

  if (keepsSavedKey && existingConnection?.encryptedApiKey) {
    try {
      apiKey = decryptApiKey(existingConnection.encryptedApiKey, getAiProviderCredentialContext(userId, "OLLAMA"));
    } catch {
      return NextResponse.json(
        { message: "Unable to read the saved Ollama API key. Enter it again." },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }
  }

  const validation = await validateOllamaConnection({ baseUrl: baseUrl.value, apiKey, model });

  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: validation.status, headers: PRIVATE_NO_STORE_HEADERS });
  }

  let encryptedApiKey: string | null = null;
  let keyHint: string | null = null;

  if (keepsSavedKey) {
    encryptedApiKey = existingConnection?.encryptedApiKey ?? null;
    keyHint = existingConnection?.keyHint ?? null;
  } else if (newApiKey) {
    try {
      encryptedApiKey = encryptApiKey(newApiKey, getAiProviderCredentialContext(userId, "OLLAMA"));
    } catch (error) {
      if (error instanceof Error && error.message === "AI_CREDENTIALS_ENCRYPTION_KEY is not configured.") {
        return encryptionUnavailableResponse();
      }

      throw error;
    }

    keyHint = newApiKey.slice(-4);
  }

  const connection = await prisma.aiProviderConnection.upsert({
    where: { userId_provider: { userId, provider: "OLLAMA" } },
    create: {
      userId,
      provider: "OLLAMA",
      baseUrl: baseUrl.value,
      encryptedApiKey,
      keyHint,
      model,
    },
    update: {
      baseUrl: baseUrl.value,
      encryptedApiKey,
      keyHint,
      model,
    },
    select: {
      provider: true,
      keyHint: true,
      model: true,
      baseUrl: true,
      updatedAt: true,
    },
  });

  await activateProviderAgent({ userId, provider: "OLLAMA", model: connection.model });

  return NextResponse.json({
    message: existingConnection ? "Ollama connection updated." : "Ollama connected successfully.",
    connection: serializeConnection({ ...connection, provider: "OLLAMA" }),
  }, { headers: PRIVATE_NO_STORE_HEADERS });
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const connections = await prisma.aiProviderConnection.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      provider: true,
      keyHint: true,
      model: true,
      baseUrl: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    connections: connections.flatMap(connection => {
      const provider = connection.provider as string;

      if (!isAiProvider(provider)) {
        return [];
      }

      return [serializeConnection({ ...connection, provider })];
    }),
    serviceOpenRouterAvailable: isServiceOpenRouterAvailable(),
  }, { headers: PRIVATE_NO_STORE_HEADERS });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  if (!body || !isAiProvider(body.provider)) {
    return NextResponse.json({ message: "A valid AI provider is required." }, { status: 400 });
  }

  const provider = body.provider;
  const providerConfig = AI_PROVIDERS.find(item => item.id === provider);

  if (!providerConfig) {
    return NextResponse.json({ message: "A valid AI provider is required." }, { status: 400 });
  }

  let encryptedApiKey: string | null = null;
  let keyHint: string | null = null;
  const model = typeof body.model === "string" ? body.model.trim() : "";

  if (model.length > 200) {
    return NextResponse.json({ message: "Model name is too long." }, { status: 400 });
  }

  if (provider === "OLLAMA") {
    return connectOllama(user.id, body, model);
  }

  if (providerConfig.kind === "api-key") {
    if (typeof body.apiKey !== "string") {
      return NextResponse.json({ message: "API key is required." }, { status: 400 });
    }

    const apiKey = body.apiKey.trim();

    if (!apiKey) {
      const existingConnection = await prisma.aiProviderConnection.findUnique({
        where: {
          userId_provider: {
            userId: user.id,
            provider,
          },
        },
        select: {
          provider: true,
          keyHint: true,
          model: true,
          updatedAt: true,
        },
      });

      if (!existingConnection) {
        return NextResponse.json({ message: "API key is required." }, { status: 400 });
      }

      const connection = await prisma.aiProviderConnection.update({
        where: { userId_provider: { userId: user.id, provider } },
        data: { model: model || null },
        select: { provider: true, keyHint: true, model: true, updatedAt: true },
      });
      if (isExternalAgentProvider(provider)) {
        await activateProviderAgent({ userId: user.id, provider, model: connection.model });
      }
      return NextResponse.json({
        message: `${PROVIDER_LABELS[provider]} connection updated.`,
        connection: serializeConnection({ ...connection, provider }),
      }, { headers: PRIVATE_NO_STORE_HEADERS });
    }

    if (apiKey.length > 500) {
      return NextResponse.json({ message: "API key is too long." }, { status: 400 });
    }

    if (provider === "GPT") {
      const validation = await validateOpenAiApiKey(apiKey);

      if (!validation.valid) {
        return NextResponse.json({ message: validation.message }, { status: validation.status });
      }
    }

    if (provider === "CLAUDE" || provider === "CURSOR") {
      const validation = await validateProviderApiKey(provider, apiKey);

      if (!validation.valid) {
        return NextResponse.json({ message: validation.message }, { status: validation.status, headers: PRIVATE_NO_STORE_HEADERS });
      }
    }

    if (provider === "OPENROUTER") {
      const validation = await validateOpenRouterApiKey(apiKey);

      if (!validation.valid) {
        return NextResponse.json({ message: validation.message }, { status: validation.status, headers: PRIVATE_NO_STORE_HEADERS });
      }
    }

    try {
      encryptedApiKey = encryptApiKey(apiKey, getAiProviderCredentialContext(user.id, provider));
    } catch (error) {
      if (error instanceof Error && error.message === "AI_CREDENTIALS_ENCRYPTION_KEY is not configured.") {
        return NextResponse.json({ message: "AI provider storage is not configured. Add AI_CREDENTIALS_ENCRYPTION_KEY." }, { status: 503 });
      }

      throw error;
    }

    keyHint = apiKey.slice(-4);
  }

  const connection = await prisma.aiProviderConnection.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider,
      },
    },
    create: {
      userId: user.id,
      provider,
      encryptedApiKey,
      keyHint,
      model: model || null,
    },
    update: {
      encryptedApiKey,
      keyHint,
      model: model || null,
    },
    select: {
      provider: true,
      keyHint: true,
      model: true,
      updatedAt: true,
    },
  });

  if (isExternalAgentProvider(provider)) {
    await activateProviderAgent({ userId: user.id, provider, model: connection.model });
  }

  return NextResponse.json({
    message: `${PROVIDER_LABELS[provider]} connected successfully.`,
    connection: serializeConnection({ ...connection, provider }),
  }, { headers: PRIVATE_NO_STORE_HEADERS });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  if (!body || !isAiProvider(body.provider)) {
    return NextResponse.json({ message: "A valid AI provider is required." }, { status: 400 });
  }

  await prisma.aiProviderConnection.deleteMany({
    where: {
      userId: user.id,
      provider: body.provider,
    },
  });

  if (isExternalAgentProvider(body.provider)) {
    await deactivateProviderAgent(user.id, body.provider);
  }

  return NextResponse.json({
    message: `${PROVIDER_LABELS[body.provider]} disconnected successfully.`,
  }, { headers: PRIVATE_NO_STORE_HEADERS });
}
