import type { Edge, Node } from "@xyflow/react";

import type { Event } from "@/lib/contracts";

export type GraphNodeKind = "event" | "entity" | "boundary";
export type GraphEdgeKind =
  | "actor_to_event"
  | "event_to_target"
  | "event_sequence"
  | "story_boundary";

export type GraphNodeData = {
  label: string;
  kind: GraphNodeKind;
  detail?: string;
  event?: Event;
};

export type GraphEdgeData = {
  kind: GraphEdgeKind;
};

export type GraphTransformOptions = {
  includeSequenceEdges?: boolean;
};

export type GraphTransformResult = {
  nodes: Node<GraphNodeData>[];
  edges: Edge<GraphEdgeData>[];
};

const STORY_START_NODE_ID = "story:start";
const STORY_END_NODE_ID = "story:end";

function normalizeEntityName(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

function toEntityNodeId(rawEntityName: string): string {
  return `entity:${normalizeEntityName(rawEntityName)}`;
}

function makeEdgeId(kind: GraphEdgeKind, source: string, target: string): string {
  return `${kind}:${source}->${target}`;
}

function addBoundaryNodes(nodeById: Map<string, Node<GraphNodeData>>): void {
  nodeById.set(STORY_START_NODE_ID, {
    id: STORY_START_NODE_ID,
    type: "default",
    position: { x: 0, y: 0 },
    style: {
      width: 140,
      borderRadius: 9999,
      border: "1px solid #3b82f6",
      background: "#172554",
      color: "#dbeafe",
      padding: 10,
      fontSize: 12,
      lineHeight: 1.3,
      textAlign: "center",
    },
    data: {
      kind: "boundary",
      label: "Start",
      detail: "Story starts here",
    },
  });

  nodeById.set(STORY_END_NODE_ID, {
    id: STORY_END_NODE_ID,
    type: "default",
    position: { x: 0, y: 0 },
    style: {
      width: 140,
      borderRadius: 9999,
      border: "1px solid #7c3aed",
      background: "#2e1065",
      color: "#ede9fe",
      padding: 10,
      fontSize: 12,
      lineHeight: 1.3,
      textAlign: "center",
    },
    data: {
      kind: "boundary",
      label: "End",
      detail: "Story ends here",
    },
  });
}

export function transformEventsToGraph(
  events: Event[],
  options: GraphTransformOptions = {},
): GraphTransformResult {
  const includeSequenceEdges = options.includeSequenceEdges ?? false;
  const nodeById = new Map<string, Node<GraphNodeData>>();
  const edgeById = new Map<string, Edge<GraphEdgeData>>();

  events.forEach((event) => {
    const eventNodeId = event.eventId;
    if (!nodeById.has(eventNodeId)) {
      const sourceSnippet =
        event.sourceText.length > 90
          ? `${event.sourceText.slice(0, 87).trimEnd()}...`
          : event.sourceText;
      nodeById.set(eventNodeId, {
        id: eventNodeId,
        type: "default",
        position: { x: 0, y: 0 },
        style: {
          width: 260,
          borderRadius: 12,
          border: "1px solid #3f3f46",
          background: "#18181b",
          color: "#f4f4f5",
          padding: 10,
          fontSize: 12,
          lineHeight: 1.35,
          whiteSpace: "normal",
          wordBreak: "break-word",
        },
        data: {
          kind: "event",
          label: `${event.action} (${Math.round(event.confidence * 100)}%) - ${sourceSnippet}`,
          detail: sourceSnippet,
          event,
        },
      });
    }

    for (const actor of event.actors) {
      const actorId = toEntityNodeId(actor);
      if (!nodeById.has(actorId)) {
        nodeById.set(actorId, {
          id: actorId,
          type: "default",
          position: { x: 0, y: 0 },
          style: {
            width: 200,
            borderRadius: 9999,
            border: "1px solid #155e75",
            background: "#0f172a",
            color: "#e2e8f0",
            padding: 10,
            fontSize: 12,
            lineHeight: 1.3,
            whiteSpace: "normal",
            wordBreak: "break-word",
          },
          data: {
            kind: "entity",
            label: actor.trim().replace(/\s+/g, " "),
          },
        });
      }

      const edgeId = makeEdgeId("actor_to_event", actorId, eventNodeId);
      if (!edgeById.has(edgeId)) {
        edgeById.set(edgeId, {
          id: edgeId,
          source: actorId,
          target: eventNodeId,
          type: "smoothstep",
          animated: false,
          data: { kind: "actor_to_event" },
          label: "acts in",
        });
      }
    }

    for (const target of event.targets ?? []) {
      const targetId = toEntityNodeId(target);
      if (!nodeById.has(targetId)) {
        nodeById.set(targetId, {
          id: targetId,
          type: "default",
          position: { x: 0, y: 0 },
          style: {
            width: 200,
            borderRadius: 9999,
            border: "1px solid #155e75",
            background: "#0f172a",
            color: "#e2e8f0",
            padding: 10,
            fontSize: 12,
            lineHeight: 1.3,
            whiteSpace: "normal",
            wordBreak: "break-word",
          },
          data: {
            kind: "entity",
            label: target.trim().replace(/\s+/g, " "),
          },
        });
      }

      const edgeId = makeEdgeId("event_to_target", eventNodeId, targetId);
      if (!edgeById.has(edgeId)) {
        edgeById.set(edgeId, {
          id: edgeId,
          source: eventNodeId,
          target: targetId,
          type: "smoothstep",
          animated: false,
          data: { kind: "event_to_target" },
          label: "affects",
        });
      }
    }
  });

  if (events.length > 0) {
    addBoundaryNodes(nodeById);

    const firstEventId = events[0].eventId;
    const lastEventId = events[events.length - 1].eventId;

    const startEdgeId = makeEdgeId("story_boundary", STORY_START_NODE_ID, firstEventId);
    edgeById.set(startEdgeId, {
      id: startEdgeId,
      source: STORY_START_NODE_ID,
      target: firstEventId,
      type: "straight",
      animated: false,
      data: { kind: "story_boundary" },
      label: "begin",
    });

    const endEdgeId = makeEdgeId("story_boundary", lastEventId, STORY_END_NODE_ID);
    edgeById.set(endEdgeId, {
      id: endEdgeId,
      source: lastEventId,
      target: STORY_END_NODE_ID,
      type: "straight",
      animated: false,
      data: { kind: "story_boundary" },
      label: "end",
    });
  }

  if (includeSequenceEdges) {
    for (let index = 0; index < events.length - 1; index += 1) {
      const sourceId = events[index].eventId;
      const targetId = events[index + 1].eventId;
      const edgeId = makeEdgeId("event_sequence", sourceId, targetId);

      if (!edgeById.has(edgeId)) {
        edgeById.set(edgeId, {
          id: edgeId,
          source: sourceId,
          target: targetId,
          type: "straight",
          animated: true,
          data: { kind: "event_sequence" },
          label: "next",
        });
      }
    }
  }

  return {
    nodes: Array.from(nodeById.values()),
    edges: Array.from(edgeById.values()),
  };
}
