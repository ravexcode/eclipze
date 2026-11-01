// Encryption contexts for stored credentials. Each one names the owner and the slot, so a
// ciphertext copied into another user's row fails to decrypt.

export function getAiProviderCredentialContext(userId: string, provider: string) {
  return `ai-provider:${userId}:${provider}`;
}

export function getMcpConnectionCredentialContext(userId: string) {
  return `mcp-connection:${userId}`;
}

export function getDatabaseConnectionCredentialContext(userId: string, provider: string) {
  return `database-connection:${userId}:${provider}`;
}
