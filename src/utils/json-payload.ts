import { readMessage } from "@/utils/agents/normalizers";

// Error responses from the platform, such as a timeout or a crashed route, may not be JSON.
// An empty object keeps callers that read payload.message on their fallback message.
export async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<unknown>;
}

export function errorMessage(payload: unknown, fallback: string) {
  return readMessage(payload, fallback);
}
