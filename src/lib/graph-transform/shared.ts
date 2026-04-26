import type { Edge, Node } from "@xyflow/react";

import type { ActionType, Event } from "@/lib/contracts";

export type GraphViewMode = "timeline" | "character";
export type CharacterEdgeStyle = "cooccurrence" | "action_labeled";
export type TimeOrderingSource = "parsed_timeHint" | "sequence_fallback";
export type GraphNodeKind = "event" | "entity" | "boundary";
export type GraphEdgeKind =
  | "actor_to_event"
  | "event_to_target"
  | "event_sequence"
  | "story_boundary"
  | "cooccurrence"
  | "action_labeled";

export type GraphNodeData = {
  label: string;
  kind: GraphNodeKind;
  detail?: string;
  event?: Event;
  timeOrderingSource?: TimeOrderingSource;
};

export type CooccurrenceEdgeData = {
  kind: "cooccurrence";
  count: number;
};

export type ActionLabeledEdgeData = {
  kind: "action_labeled";
  action: ActionType;
};

export type TimelineEdgeData = {
  kind: "actor_to_event" | "event_to_target" | "event_sequence" | "story_boundary";
};

export type GraphEdgeData = CooccurrenceEdgeData | ActionLabeledEdgeData | TimelineEdgeData;

export type GraphTransformMeta = {
  mode: GraphViewMode;
  characterEdgeStyle?: CharacterEdgeStyle;
  relationEdgeCount: number;
  fallbackOrderCount: number;
  densityStatus: "ok" | "warn" | "blocked";
  thresholds: {
    warn: number;
    block: number;
  };
  droppedEventCount: number;
};

export type GraphTransformResult = {
  nodes: Node<GraphNodeData>[];
  edges: Edge<GraphEdgeData>[];
  meta?: GraphTransformMeta;
};

export type GraphTransformOptions = {
  includeSequenceEdges?: boolean;
  mode?: GraphViewMode;
  characterEdgeStyle?: CharacterEdgeStyle;
};

export const STORY_START_NODE_ID = "story:start";
export const STORY_END_NODE_ID = "story:end";

export function normalizeEntityName(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeEntityLabel(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function toEntityNodeId(rawEntityName: string): string {
  return `entity:${normalizeEntityName(rawEntityName)}`;
}

export function lexicalCompare(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

export function makeTimelineEdgeId(
  kind: "actor_to_event" | "event_to_target" | "event_sequence" | "story_boundary",
  source: string,
  target: string,
): string {
  return `${kind}:${source}->${target}`;
}

export function makeNodeStyles(kind: GraphNodeKind): Node<GraphNodeData>["style"] {
  if (kind === "boundary") {
    return {
      width: 140,
      borderRadius: 9999,
      border: "1px solid #3b82f6",
      background: "#172554",
      color: "#dbeafe",
      padding: 10,
      fontSize: 12,
      lineHeight: 1.3,
      textAlign: "center",
    };
  }

  if (kind === "entity") {
    return {
      width: 220,
      borderRadius: 9999,
      border: "1px solid #155e75",
      background: "#0f172a",
      color: "#e2e8f0",
      padding: 10,
      fontSize: 12,
      lineHeight: 1.3,
      whiteSpace: "normal",
      wordBreak: "break-word",
    };
  }

  return {
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
  };
}

export function classifyDensity(
  edgeCount: number,
  thresholds: { warn: number; block: number },
): "ok" | "warn" | "blocked" {
  if (edgeCount >= thresholds.block) {
    return "blocked";
  }
  if (edgeCount >= thresholds.warn) {
    return "warn";
  }
  return "ok";
}
