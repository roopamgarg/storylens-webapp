import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";

import type { GraphEdgeData, GraphNodeData } from "@/lib/graph-transform";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;

export function applyDagreLayout(
  nodes: Node<GraphNodeData>[],
  edges: Edge<GraphEdgeData>[],
): Node<GraphNodeData>[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    ranksep: 100,
    nodesep: 40,
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
