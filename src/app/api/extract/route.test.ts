import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const validRequest = {
  story: "Aria discovers a hidden map.",
};

const validSuccessResponse = {
  events: [
    {
      eventId: "11111111-1111-4111-8111-111111111111",
      action: "DISCOVER",
      actors: ["Aria"],
      targets: ["Map"],
      sourceText: "Aria discovers a hidden map.",
      confidence: 0.89,
    },
  ],
  model: "gemini-2.5-flash",
  requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

async function importRoute() {
  vi.resetModules();
  return import("@/app/api/extract/route");
}

describe("POST /api/extract proxy route", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_LAYER_BASE_URL", "http://localhost:3000");
    vi.stubEnv("REQUEST_TIMEOUT_MS", "95000");
    vi.stubEnv("LLM_LAYER_API_KEY", "local-test-key");
    vi.stubEnv("PRONOUN_RESOLVER_MAX_CHARS", "10000");
    vi.stubEnv("NEXT_PUBLIC_PRONOUN_RESOLVER_MAX_CHARS", "10000");
    vi.stubEnv("ENABLE_PRONOUN_RESOLUTION", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("maps upstream structured errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests.",
            },
            requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        ),
      );

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: JSON.stringify(validRequest),
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("handles upstream non-json payload as provider error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html>bad gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    );

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: JSON.stringify(validRequest),
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("PROVIDER_ERROR");
  });

  it("returns validated success payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(validSuccessResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: JSON.stringify(validRequest),
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toHaveLength(1);
    expect(body.requestId).toBe(validSuccessResponse.requestId);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(validRequest));
  });

  it("keeps upstream body unchanged when resolver flag is on", async () => {
    vi.stubEnv("ENABLE_PRONOUN_RESOLUTION", "true");
    const resolvePronounsMock = vi.fn().mockResolvedValue({
      resolvedStory: "Aria discovers a hidden map.",
      stats: { pronounsFound: 1, pronounsResolved: 1, pronounsSkipped: 0 },
      applied: [
        {
          pronoun: "She",
          position: { sentenceIndex: 1, tokenIndex: 0 },
          replacement: "Aria",
          confidence: "high",
        },
      ],
    });

    vi.doMock("@/lib/pronoun-resolver", () => ({
      resolvePronouns: resolvePronounsMock,
    }));

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(validSuccessResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: JSON.stringify(validRequest),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(resolvePronounsMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(validRequest));
    expect(logSpy).toHaveBeenCalledTimes(1);

    const loggedJson = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"));
    expect(loggedJson.event).toBe("pronoun_resolver");
    expect(loggedJson.pronounsResolved).toBe(1);

    vi.doUnmock("@/lib/pronoun-resolver");
  });

  it("logs skip when story exceeds resolver cap", async () => {
    vi.stubEnv("ENABLE_PRONOUN_RESOLUTION", "true");
    vi.stubEnv("PRONOUN_RESOLVER_MAX_CHARS", "10");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(validSuccessResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: JSON.stringify({ story: "This story is definitely longer than ten characters." }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const loggedJson = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"));
    expect(loggedJson.skipReason).toBe("input_too_long");
    expect(loggedJson.event).toBe("pronoun_resolver");
  });
});
