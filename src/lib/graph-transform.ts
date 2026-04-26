import type { Event } from "@/lib/contracts";

import { transformCharacterGraph } from "@/lib/graph-transform/character";
import {
  type CharacterEdgeStyle,
  type GraphEdgeData,
  type GraphEdgeKind,
  type GraphNodeData,
  type GraphNodeKind,
  type GraphTransformMeta,
  type GraphTransformOptions,
  type GraphTransformResult,
  type GraphViewMode,
  type TimeOrderingSource,
} from "@/lib/graph-transform/shared";
import { transformTimelineGraph } from "@/lib/graph-transform/timeline";

export type {
  CharacterEdgeStyle,
  GraphEdgeData,
  GraphEdgeKind,
  GraphNodeData,
  GraphNodeKind,
  GraphTransformMeta,
  GraphTransformOptions,
  GraphTransformResult,
  GraphViewMode,
  TimeOrderingSource,
};

export function transformEventsToGraph(
  events: Event[],
  options: GraphTransformOptions = {},
): GraphTransformResult {
  const mode = options.mode ?? "timeline";
  if (mode === "character") {
    const style: CharacterEdgeStyle = options.characterEdgeStyle ?? "cooccurrence";
    return transformCharacterGraph(events, style);
  }

  return transformTimelineGraph(events, {
    includeSequenceEdges: options.includeSequenceEdges ?? false,
  });
}
