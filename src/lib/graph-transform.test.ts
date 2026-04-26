import { describe, expect, it } from "vitest";

import { transformEventsToGraph } from "@/lib/graph-transform";
import type { Event } from "@/lib/contracts";
import { appLimits } from "@/lib/constants";

const baseEvent: Event = {
  eventId: "11111111-1111-4111-8111-111111111111",
  action: "DISCOVER",
  actors: ["Aria"],
  targets: ["Map"],
  sourceText: "Aria discovered the map.",
  confidence: 0.92,
};

function buildRelationEvents(edgeCount: number): Event[] {
  const events: Event[] = [];
  let edgeIndex = 0;
  let eventCounter = 1;
  for (let left = 0; left < 60; left += 1) {
    for (let right = left + 1; right < 60; right += 1) {
      if (edgeIndex >= edgeCount) {
        return events;
      }
      const paddedCounter = eventCounter.toString().padStart(12, "0");
      events.push({
        ...baseEvent,
        eventId: `00000000-0000-4000-8000-${paddedCounter}`,
        actors: [`Entity ${left}`],
        targets: [`Entity ${right}`],
      });
      edgeIndex += 1;
      eventCounter += 1;
    }
  }
  return events;
}

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

  it("orders timeline by parseable timeHint first and falls back to sequence order", () => {
    const events: Event[] = [
      {
        ...baseEvent,
        eventId: "aaaa1111-1111-4111-8111-111111111111",
        timeHint: "second",
      },
      {
        ...baseEvent,
        eventId: "bbbb2222-2222-4222-8222-222222222222",
        timeHint: "2026-04-26",
      },
      {
        ...baseEvent,
        eventId: "cccc3333-3333-4333-8333-333333333333",
        timeHint: "later",
      },
    ];

    const graph = transformEventsToGraph(events, { includeSequenceEdges: true, mode: "timeline" });
    const sequenceEdges = graph.edges.filter((edge) => edge.data?.kind === "event_sequence");

    expect(sequenceEdges.map((edge) => edge.id)).toEqual([
      "event_sequence:bbbb2222-2222-4222-8222-222222222222->aaaa1111-1111-4111-8111-111111111111",
      "event_sequence:aaaa1111-1111-4111-8111-111111111111->cccc3333-3333-4333-8333-333333333333",
    ]);
    expect(graph.meta?.fallbackOrderCount).toBe(1);
  });

  it("adds start and end boundary nodes for story flow", () => {
    const result = transformEventsToGraph([baseEvent]);

    expect(result.nodes.some((node) => node.id === "story:start" && node.data.kind === "boundary")).toBe(
      true,
    );
    expect(result.nodes.some((node) => node.id === "story:end" && node.data.kind === "boundary")).toBe(
      true,
    );

    expect(
      result.edges.some(
        (edge) =>
          edge.id ===
          "story_boundary:story:start->11111111-1111-4111-8111-111111111111",
      ),
    ).toBe(true);

    expect(
      result.edges.some(
        (edge) =>
          edge.id ===
          "story_boundary:11111111-1111-4111-8111-111111111111->story:end",
      ),
    ).toBe(true);
  });

  it("returns empty graph for empty events input", () => {
    const result = transformEventsToGraph([]);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("builds character cooccurrence graph with deduped pair IDs and counts", () => {
    const events: Event[] = [
      {
        ...baseEvent,
        eventId: "dddd1111-1111-4111-8111-111111111111",
        actors: ["Aria"],
        targets: ["Borin"],
      },
      {
        ...baseEvent,
        eventId: "dddd2222-2222-4222-8222-222222222222",
        actors: ["Borin"],
        targets: ["Aria"],
      },
    ];

    const graph = transformEventsToGraph(events, {
      mode: "character",
      characterEdgeStyle: "cooccurrence",
    });

    expect(graph.nodes.some((node) => node.id === "story:start")).toBe(false);
    expect(graph.edges).toHaveLength(1);
    const [onlyEdge] = graph.edges;
    expect(onlyEdge?.id).toBe("cooccurrence:entity:aria|entity:borin");
    expect(onlyEdge?.data?.kind).toBe("cooccurrence");
    if (onlyEdge?.data?.kind === "cooccurrence") {
      expect(onlyEdge.data.count).toBe(2);
    }
    expect(graph.meta?.relationEdgeCount).toBe(1);
    expect(graph.meta?.characterEdgeStyle).toBe("cooccurrence");
  });

  it("builds action-labeled graph as directed actor-target edges", () => {
    const events: Event[] = [
      {
        ...baseEvent,
        eventId: "eeee1111-1111-4111-8111-111111111111",
        action: "ATTACK",
        actors: ["Aria", "Borin"],
        targets: ["Beast"],
      },
    ];

    const graph = transformEventsToGraph(events, {
      mode: "character",
      characterEdgeStyle: "action_labeled",
    });

    const actionEdges = graph.edges.filter((edge) => edge.data?.kind === "action_labeled");
    expect(actionEdges.map((edge) => edge.id).sort()).toEqual([
      "action_labeled:ATTACK:entity:aria->entity:beast",
      "action_labeled:ATTACK:entity:borin->entity:beast",
    ]);
    expect(graph.meta?.droppedEventCount).toBe(0);
  });

  it("reports dropped events and density status for character mode", () => {
    const events: Event[] = [
      {
        ...baseEvent,
        eventId: "ffff1111-1111-4111-8111-111111111111",
        actors: ["Solo"],
        targets: [],
      },
    ];
    const graph = transformEventsToGraph(events, {
      mode: "character",
      characterEdgeStyle: "action_labeled",
    });

    expect(graph.meta?.droppedEventCount).toBe(1);
    expect(graph.meta?.densityStatus).toBe("ok");
  });

  it("enforces character density thresholds at warn/block boundaries", () => {
    const warnMinusOne = transformEventsToGraph(
      buildRelationEvents(appLimits.characterGraphWarnEdges - 1),
      {
        mode: "character",
        characterEdgeStyle: "action_labeled",
      },
    );
    expect(warnMinusOne.meta?.densityStatus).toBe("ok");

    const warnAt = transformEventsToGraph(buildRelationEvents(appLimits.characterGraphWarnEdges), {
      mode: "character",
      characterEdgeStyle: "action_labeled",
    });
    expect(warnAt.meta?.densityStatus).toBe("warn");

    const blockMinusOne = transformEventsToGraph(
      buildRelationEvents(appLimits.characterGraphBlockEdges - 1),
      {
        mode: "character",
        characterEdgeStyle: "action_labeled",
      },
    );
    expect(blockMinusOne.meta?.densityStatus).toBe("warn");

    const blockAt = transformEventsToGraph(buildRelationEvents(appLimits.characterGraphBlockEdges), {
      mode: "character",
      characterEdgeStyle: "action_labeled",
    });
    expect(blockAt.meta?.densityStatus).toBe("blocked");
  });
});
