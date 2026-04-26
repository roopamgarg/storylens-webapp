import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  errorResponseSchema,
  extractEventsRequestSchema,
  extractEventsResponseSchema,
  type ErrorCode,
} from "@/lib/contracts";
import { appLimits } from "@/lib/constants";
import { serverEnv } from "@/lib/env";
import { resolvePronouns } from "@/lib/pronoun-resolver";

export const runtime = "nodejs";

let inFlightRequests = 0;

type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

function makeErrorBody(code: ErrorCode, message: string, details?: unknown): ApiErrorBody {
  return {
    error: { code, message, details },
    requestId: randomUUID(),
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function parseErrorPayload(raw: unknown): ApiErrorBody | undefined {
  const parsed = errorResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();

  if (inFlightRequests >= appLimits.maxConcurrentRequests) {
    return jsonResponse(
      makeErrorBody(
        "RATE_LIMITED",
        "The graph service is busy. Please retry in a moment.",
      ),
      429,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      makeErrorBody("INVALID_REQUEST", "Request body must be valid JSON."),
      400,
    );
  }

  const requestParseResult = extractEventsRequestSchema.safeParse(payload);
  if (!requestParseResult.success) {
    return jsonResponse(
      makeErrorBody("INVALID_REQUEST", "Invalid extract request payload.", {
        issues: z.treeifyError(requestParseResult.error),
      }),
      400,
    );
  }

  if (serverEnv.enablePronounResolution) {
    const storyLengthChars = requestParseResult.data.story.length;
    const start = Date.now();

    if (storyLengthChars > serverEnv.pronounResolverMaxChars) {
      console.log(
        JSON.stringify({
          event: "pronoun_resolver",
          requestId,
          pronounsFound: 0,
          pronounsResolved: 0,
          pronounsSkipped: 0,
          skipReason: "input_too_long",
          storyLengthChars,
          durationMs: 0,
        }),
      );
    } else {
      try {
        const resolved = await resolvePronouns(requestParseResult.data.story, {
          maxChars: serverEnv.pronounResolverMaxChars,
        });

        console.log(
          JSON.stringify({
            event: "pronoun_resolver",
            requestId,
            pronounsFound: resolved.stats.pronounsFound,
            pronounsResolved: resolved.stats.pronounsResolved,
            pronounsSkipped: resolved.stats.pronounsSkipped,
            skipReason: resolved.skipReason ?? null,
            storyLengthChars,
            durationMs: Date.now() - start,
          }),
        );
      } catch (error) {
        console.log(
          JSON.stringify({
            event: "pronoun_resolver_error",
            requestId,
            storyLengthChars,
            durationMs: Date.now() - start,
            message: error instanceof Error ? error.message : "unknown",
          }),
        );
      }
    }
  }

  const upstreamController = new AbortController();
  const timeout = setTimeout(
    () => upstreamController.abort(new Error("upstream_timeout")),
    serverEnv.requestTimeoutMs,
  );

  const abortProxy = () => upstreamController.abort(new Error("request_aborted_by_client"));
  request.signal.addEventListener("abort", abortProxy);
  inFlightRequests += 1;

  try {
    const headers = new Headers({ "content-type": "application/json" });
    if (serverEnv.llmLayerApiKey) {
      headers.set("x-api-key", serverEnv.llmLayerApiKey);
    }

    const upstreamResponse = await fetch(`${serverEnv.llmLayerBaseUrl}/v1/events/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestParseResult.data),
      signal: upstreamController.signal,
      cache: "no-store",
    });

    let upstreamBody: unknown;
    try {
      upstreamBody = await upstreamResponse.json();
    } catch {
      return jsonResponse(
        makeErrorBody("PROVIDER_ERROR", "Invalid upstream response payload."),
        502,
      );
    }

    if (!upstreamResponse.ok) {
      const parsed = parseErrorPayload(upstreamBody);
      if (parsed) {
        return jsonResponse(parsed, upstreamResponse.status);
      }

      return jsonResponse(
        makeErrorBody("PROVIDER_ERROR", "Upstream error response was invalid.", {
          status: upstreamResponse.status,
        }),
        502,
      );
    }

    const responseParseResult = extractEventsResponseSchema.safeParse(upstreamBody);
    if (!responseParseResult.success) {
      return jsonResponse(
        makeErrorBody("PROVIDER_ERROR", "Upstream success response failed validation.", {
          issues: z.treeifyError(responseParseResult.error),
        }),
        502,
      );
    }

    return jsonResponse(responseParseResult.data, 200);
  } catch (error) {
    if (upstreamController.signal.aborted) {
      const reason = upstreamController.signal.reason;
      if (reason instanceof Error && reason.message === "request_aborted_by_client") {
        return jsonResponse(makeErrorBody("INTERNAL_ERROR", "Request cancelled."), 499);
      }

      return jsonResponse(
        makeErrorBody("PROVIDER_ERROR", "Upstream service timeout."),
        504,
      );
    }

    if (error instanceof Error && error.name === "TypeError") {
      return jsonResponse(
        makeErrorBody("PROVIDER_ERROR", "Upstream service unreachable."),
        502,
      );
    }

    return jsonResponse(
      makeErrorBody("INTERNAL_ERROR", "Unexpected proxy error."),
      500,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortProxy);
    inFlightRequests = Math.max(0, inFlightRequests - 1);
  }
}
