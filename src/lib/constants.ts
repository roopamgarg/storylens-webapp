export const DEFAULT_REQUEST_TIMEOUT_MS = 95_000;
export const DEFAULT_BROWSER_TIMEOUT_MS = 100_000;
export const DEFAULT_PRONOUN_RESOLVER_TIMEOUT_MS = 500;
export const MAX_STORY_CHARS = 50_000;
export const MAX_CONCURRENT_REQUESTS = 2;
export const LARGE_GRAPH_WARN_EVENTS = 80;
export const LARGE_GRAPH_BLOCK_EVENTS = 150;
export const CHARACTER_GRAPH_WARN_EDGES = 120;
export const CHARACTER_GRAPH_BLOCK_EDGES = 240;

const DEFAULT_PRONOUN_PREVIEW_MAX_CHARS = 10_000;

function parsePublicLimit(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export const appLimits = {
  browserTimeoutMs: DEFAULT_BROWSER_TIMEOUT_MS,
  maxStoryChars: MAX_STORY_CHARS,
  maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
  largeGraphWarnEvents: LARGE_GRAPH_WARN_EVENTS,
  largeGraphBlockEvents: LARGE_GRAPH_BLOCK_EVENTS,
  characterGraphWarnEdges: CHARACTER_GRAPH_WARN_EDGES,
  characterGraphBlockEdges: CHARACTER_GRAPH_BLOCK_EDGES,
  pronounPreviewMaxChars: parsePublicLimit(
    process.env.NEXT_PUBLIC_PRONOUN_RESOLVER_MAX_CHARS,
    DEFAULT_PRONOUN_PREVIEW_MAX_CHARS,
  ),
};
