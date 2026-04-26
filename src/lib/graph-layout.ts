import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";

import type { GraphEdgeData, GraphNodeData, GraphViewMode } from "@/lib/graph-transform";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;

export function applyDagreLayout(
  nodes: Node<GraphNodeData>[],
  edges: Edge<GraphEdgeData>[],
  options: { mode?: GraphViewMode } = {},
): Node<GraphNodeData>[] {
  const mode = options.mode ?? "timeline";
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: mode === "character" ? "TB" : "LR",
    ranksep: mode === "character" ? 70 : 100,
    nodesep: mode === "character" ? 30 : 40,
  });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });
}
