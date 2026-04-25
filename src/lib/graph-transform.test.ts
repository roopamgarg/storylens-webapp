import { describe, expect, it } from "vitest";

import { transformEventsToGraph } from "@/lib/graph-transform";
import type { Event } from "@/lib/contracts";

const baseEvent: Event = {
  eventId: "11111111-1111-4111-8111-111111111111",
  action: "DISCOVER",
  actors: ["Aria"],
  targets: ["Map"],
  sourceText: "Aria discovered the map.",
  confidence: 0.92,
};

describe("transformEventsToGraph", () => {
  it("deduplicates entities using normalized identity", () => {
    const events: Event[] = [
      {
        ...baseEvent,
        actors: [" Aria "],
      },
      {
        ...baseEvent,
        eventId: "22222222-2222-4222-8222-222222222222",
        action: "SPEAK",
        actors: ["aria"],
        targets: ["  MAP  "],
        sourceText: "aria speaks about map",
      },
    ];

    const result = transformEventsToGraph(events);
    const entityNodes = result.nodes.filter((node) => node.id.startsWith("entity:"));

    expect(entityNodes.map((node) => node.id).sort()).toEqual(["entity:aria", "entity:map"]);
  });

  it("creates deterministic edge IDs and optional sequence edges", () => {
    const events: Event[] = [
      baseEvent,
      {
        ...baseEvent,
        eventId: "33333333-3333-4333-8333-333333333333",
        action: "MOVE",
        actors: ["Borin"],
        targets: [],
        sourceText: "Borin moved closer.",
      },
    ];

    const withoutSequence = transformEventsToGraph(events);
    const withSequence = transformEventsToGraph(events, { includeSequenceEdges: true });

    expect(withoutSequence.edges.some((edge) => edge.id.includes("event_sequence"))).toBe(false);
    expect(
      withSequence.edges.some(
        (edge) =>
          edge.id ===
          "event_sequence:11111111-1111-4111-8111-111111111111->33333333-3333-4333-8333-333333333333",
      ),
    ).toBe(true);
  });

  it("returns empty graph for empty events input", () => {
    const result = transformEventsToGraph([]);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});
