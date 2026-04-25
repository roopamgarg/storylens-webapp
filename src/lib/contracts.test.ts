import fixture from "@/test/fixtures/extract-events.success.json";
import { extractEventsResponseSchema } from "@/lib/contracts";
import { describe, expect, it } from "vitest";

describe("extract events contract fixture", () => {
  it("matches the pinned success response shape", () => {
    const parsed = extractEventsResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
  });
});
