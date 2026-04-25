import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/constants";

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

export const serverEnv = {
  llmLayerBaseUrl: parseUrl("LLM_LAYER_BASE_URL", process.env.LLM_LAYER_BASE_URL),
  llmLayerApiKey: process.env.LLM_LAYER_API_KEY?.trim() || undefined,
  requestTimeoutMs: parseMs(
    "REQUEST_TIMEOUT_MS",
    process.env.REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
  ),
};
