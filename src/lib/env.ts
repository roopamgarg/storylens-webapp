import {
  DEFAULT_PRONOUN_RESOLVER_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "@/lib/constants";

const DEFAULT_PRONOUN_RESOLVER_MAX_CHARS = 10_000;

function parseUrl(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }

  try {
    const parsed = new URL(value);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
}

function parseMs(name: string, value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return Math.floor(parsed);
}

function parsePositiveIntOrDefault(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

const pronounResolverMaxChars = parsePositiveIntOrDefault(
  process.env.PRONOUN_RESOLVER_MAX_CHARS,
  DEFAULT_PRONOUN_RESOLVER_MAX_CHARS,
);
const pronounResolverTimeoutMs = parsePositiveIntOrDefault(
  process.env.PRONOUN_RESOLVER_TIMEOUT_MS,
  DEFAULT_PRONOUN_RESOLVER_TIMEOUT_MS,
);

const clientPreviewMaxChars = parsePositiveIntOrDefault(
  process.env.NEXT_PUBLIC_PRONOUN_RESOLVER_MAX_CHARS,
  DEFAULT_PRONOUN_RESOLVER_MAX_CHARS,
);

if (pronounResolverMaxChars !== clientPreviewMaxChars) {
  console.warn(
    "[env] PRONOUN_RESOLVER_MAX_CHARS and NEXT_PUBLIC_PRONOUN_RESOLVER_MAX_CHARS differ.",
    {
      server: pronounResolverMaxChars,
      client: clientPreviewMaxChars,
    },
  );
}

export const serverEnv = {
  llmLayerBaseUrl: parseUrl("LLM_LAYER_BASE_URL", process.env.LLM_LAYER_BASE_URL),
  llmLayerApiKey: process.env.LLM_LAYER_API_KEY?.trim() || undefined,
  requestTimeoutMs: parseMs(
    "REQUEST_TIMEOUT_MS",
    process.env.REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
  ),
  enablePronounResolution: process.env.ENABLE_PRONOUN_RESOLUTION === "true",
  pronounResolverMaxChars,
  pronounResolverTimeoutMs,
};
