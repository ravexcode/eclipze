import "server-only";

import { decryptApiKey } from "@/lib/ai-credentials";
import { getOpenRouterCredential } from "@/lib/openrouter";
import prisma from "@/lib/prisma";
import { PROVIDER_LABELS } from "@/constants/agent-providers";
import type { AiProvider, ProviderCredential } from "@/types/ai";
import { getAiProviderCredentialContext } from "@/utils/ai-credentials";

export async function getProviderApiKey(userId: string, provider: AiProvider) {
  const connection = await prisma.aiProviderConnection.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { encryptedApiKey: true },
  });

  if (!connection?.encryptedApiKey) return null;

  try {
    return decryptApiKey(connection.encryptedApiKey, getAiProviderCredentialContext(userId, provider));
  } catch {
    throw new Error(`Unable to read the saved ${PROVIDER_LABELS[provider]} connection. Reconnect it in Settings.`);
  }
}

// Ollama connects by server URL; its API key is optional and only used behind a proxy.
async function getOllamaCredential(userId: string): Promise<ProviderCredential | null> {
  const connection = await prisma.aiProviderConnection.findUnique({
    where: { userId_provider: { userId, provider: "OLLAMA" } },
    select: { baseUrl: true },
  });

  if (!connection?.baseUrl) return null;

  const apiKey = await getProviderApiKey(userId, "OLLAMA");

  return { apiKey: apiKey ?? "", isServiceKey: false, baseUrl: connection.baseUrl };
}

// OpenRouter may resolve to the Eclipse service key; other providers use the user's saved key.
export async function getProviderCredential(userId: string, provider: AiProvider): Promise<ProviderCredential | null> {
  if (provider === "OPENROUTER") return getOpenRouterCredential(userId);
  if (provider === "OLLAMA") return getOllamaCredential(userId);

  const apiKey = await getProviderApiKey(userId, provider);
  return apiKey ? { apiKey, isServiceKey: false } : null;
}
