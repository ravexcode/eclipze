import { HTML_ESCAPES } from "@/constants/html";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => HTML_ESCAPES[character] ?? character);
}
