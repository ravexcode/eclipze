import { OLLAMA_MAX_BASE_URL_LENGTH } from "@/constants/ollama";

function parseIpv4(address: string) {
  const match = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

  if (!match) {
    return null;
  }

  const octets = match.slice(1).map(Number);

  return octets.every(octet => octet <= 255) ? octets : null;
}

function isPrivateIpv4(octets: number[]) {
  const [first, second] = octets;

  return first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && octets[2] === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224;
}

// Reads the IPv4 address inside an IPv4-mapped IPv6 address, such as ::ffff:127.0.0.1
// or ::ffff:7f00:1.
function readMappedIpv4(address: string) {
  const mapped = address.match(/^::ffff:(.+)$/);

  if (!mapped) {
    return null;
  }

  const dotted = parseIpv4(mapped[1]);

  if (dotted) {
    return dotted;
  }

  const hexGroups = mapped[1].match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);

  if (!hexGroups) {
    return null;
  }

  const high = Number.parseInt(hexGroups[1], 16);
  const low = Number.parseInt(hexGroups[2], 16);

  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

// True for loopback, private, link-local, carrier-grade NAT, multicast, and reserved
// addresses, which a public server must never be asked to call.
export function isPrivateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const ipv4 = parseIpv4(normalized) ?? readMappedIpv4(normalized);

  if (ipv4) {
    return isPrivateIpv4(ipv4);
  }

  return normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff");
}

export function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal");
}

// Checks the shape of an Ollama server URL and returns it without a trailing slash or a
// pasted /api or /v1 suffix. Network rules are checked on the server before each request.
export function normalizeOllamaBaseUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "Enter the URL of your Ollama server." } as const;
  }

  const candidate = value.trim();

  if (candidate.length > OLLAMA_MAX_BASE_URL_LENGTH) {
    return { error: "The Ollama server URL is too long." } as const;
  }

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    return { error: "Enter a valid URL, such as http://localhost:11434." } as const;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "The Ollama server URL must start with http:// or https://." } as const;
  }

  if (url.username || url.password || url.search || url.hash) {
    return { error: "Remove credentials, query data, and fragments from the Ollama server URL." } as const;
  }

  const pathname = url.pathname
    .replace(/\/+$/, "")
    .replace(/\/(api|v1)$/, "");

  return { value: `${url.origin}${pathname}` } as const;
}

// Ollama lists models as name:tag. A model without a tag means the "latest" tag.
export function isSameOllamaModel(installedModel: string, requestedModel: string) {
  const withTag = (model: string) => model.includes(":") ? model : `${model}:latest`;

  return withTag(installedModel) === withTag(requestedModel);
}
