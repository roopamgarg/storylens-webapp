import fixture from "@/test/fixtures/extract-events.success.json";
import { extractEventsResponseSchema, graphDiagnosticSchema } from "@/lib/contracts";
import { describe, expect, it } from "vitest";

describe("extract events contract fixture", () => {
  it("matches the pinned success response shape", () => {
    const parsed = extractEventsResponseSchema.safeParse(fixture);
    expect(parsed.success).toBe(true);
  });
});

describe("graph diagnostic contract", () => {
  it("accepts a valid diagnostic payload", () => {
    const parsed = graphDiagnosticSchema.safeParse({
      id: "timeline:missing_temporal_edge:abc123",
      category: "timeline",
      subtype: "missing_temporal_edge",
      severity: "warning",
      message: "Temporal edge missing.",
      confidence: 0.92,
      nodeIds: ["evt-1"],
      edgeIds: ["event_sequence:evt-1->evt-2"],
      evidence: {
        eventIds: ["evt-1", "evt-2"],
        notes: ["sequence disabled"],
      },
    });
    expect(parsed.success).toBe(true);
  });
});
