export const DEFAULT_REQUEST_TIMEOUT_MS = 95_000;
export const DEFAULT_BROWSER_TIMEOUT_MS = 100_000;
export const MAX_STORY_CHARS = 50_000;
export const MAX_CONCURRENT_REQUESTS = 2;
export const LARGE_GRAPH_WARN_EVENTS = 80;
export const LARGE_GRAPH_BLOCK_EVENTS = 150;

export const appLimits = {
  browserTimeoutMs: DEFAULT_BROWSER_TIMEOUT_MS,
  maxStoryChars: MAX_STORY_CHARS,
  maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
  largeGraphWarnEvents: LARGE_GRAPH_WARN_EVENTS,
  largeGraphBlockEvents: LARGE_GRAPH_BLOCK_EVENTS,
};
