export function isConnectionError(error: unknown) {
  return !(error instanceof Error && error.name === "AbortError");
}
