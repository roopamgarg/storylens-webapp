import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";

import { applyDagreLayout } from "@/lib/graph-layout";
import type { GraphEdgeData, GraphNodeData } from "@/lib/graph-transform";

function makeNode(id: string): Node<GraphNodeData> {
  return {
    id,
    type: "default",
    position: { x: 0, y: 0 },
    data: { kind: "event", label: id },
  };
}

function makeEdge(id: string, source: string, target: string): Edge<GraphEdgeData> {
  return {
    id,
    source,
    target,
    data: { kind: "event_sequence" },
  };
}

describe("applyDagreLayout", () => {
  it("is deterministic for the same input", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c")];

    const first = applyDagreLayout(nodes, edges, { mode: "timeline" });
    const second = applyDagreLayout(nodes, edges, { mode: "timeline" });

    expect(first).toEqual(second);
  });

  it("uses different positioning profile for timeline and character mode", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "b", "c")];

    const timeline = applyDagreLayout(nodes, edges, { mode: "timeline" });
    const character = applyDagreLayout(nodes, edges, { mode: "character" });

    expect(timeline).not.toEqual(character);
  });
});
