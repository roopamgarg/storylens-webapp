import type { Edge, Node } from "@xyflow/react";

import type { Event } from "@/lib/contracts";

import {
  STORY_END_NODE_ID,
  STORY_START_NODE_ID,
  type GraphEdgeData,
  type GraphNodeData,
  type GraphTransformMeta,
  type GraphTransformResult,
  makeNodeStyles,
  makeTimelineEdgeId,
  normalizeEntityLabel,
  toEntityNodeId,
  type TimeOrderingSource,
} from "./shared";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const ORDINAL_TO_INDEX: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
};

type OrderedEvent = {
  event: Event;
  originalIndex: number;
  sortKey: [number, number];
  orderingSource: TimeOrderingSource;
};

function parseTimeHintSortKey(timeHint: string | undefined): [number, number] | null {
  if (!timeHint) {
    return null;
  }

  const trimmed = timeHint.trim();
  if (!trimmed) {
    return null;
  }

  if (ISO_DATE_RE.test(trimmed)) {
    const epoch = Date.parse(`${trimmed}T00:00:00.000Z`);
    if (Number.isFinite(epoch)) {
      return [0, epoch];
    }
  }

  if (ISO_DATETIME_RE.test(trimmed)) {
    const epoch = Date.parse(trimmed);
    if (Number.isFinite(epoch)) {
      return [0, epoch];
    }
  }

  const ordinal = ORDINAL_TO_INDEX[trimmed.toLowerCase()];
  if (ordinal !== undefined) {
    return [1, ordinal];
  }

  return null;
}

function toOrderedEvents(events: Event[]): OrderedEvent[] {
  return events
    .map((event, originalIndex) => {
      const parsedSortKey = parseTimeHintSortKey(event.timeHint);
      if (parsedSortKey) {
        return {
          event,
          originalIndex,
          sortKey: parsedSortKey,
          orderingSource: "parsed_timeHint" as const,
        };
      }

      return {
        event,
        originalIndex,
        sortKey: [2, originalIndex] as [number, number],
        orderingSource: "sequence_fallback" as const,
      };
    })
    .sort((left, right) => {
      if (left.sortKey[0] !== right.sortKey[0]) {
        return left.sortKey[0] - right.sortKey[0];
      }
      if (left.sortKey[1] !== right.sortKey[1]) {
        return left.sortKey[1] - right.sortKey[1];
      }
      return left.originalIndex - right.originalIndex;
    });
}

function addBoundaryNodes(nodeById: Map<string, Node<GraphNodeData>>): void {
  nodeById.set(STORY_START_NODE_ID, {
    id: STORY_START_NODE_ID,
    type: "default",
    position: { x: 0, y: 0 },
    style: makeNodeStyles("boundary"),
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
      ...makeNodeStyles("boundary"),
      border: "1px solid #7c3aed",
      background: "#2e1065",
      color: "#ede9fe",
    },
    data: {
      kind: "boundary",
      label: "End",
      detail: "Story ends here",
    },
  });
}

export function transformTimelineGraph(
  events: Event[],
  options: { includeSequenceEdges: boolean },
): GraphTransformResult {
  const orderedEvents = toOrderedEvents(events);
  const nodeById = new Map<string, Node<GraphNodeData>>();
  const edgeById = new Map<string, Edge<GraphEdgeData>>();

  for (const orderedEvent of orderedEvents) {
    const { event, orderingSource } = orderedEvent;
    const sourceSnippet =
      event.sourceText.length > 90 ? `${event.sourceText.slice(0, 87).trimEnd()}...` : event.sourceText;

    if (!nodeById.has(event.eventId)) {
      nodeById.set(event.eventId, {
        id: event.eventId,
        type: "default",
        position: { x: 0, y: 0 },
        style: makeNodeStyles("event"),
        data: {
          kind: "event",
          label: `${event.action} (${Math.round(event.confidence * 100)}%) - ${sourceSnippet}`,
          detail: sourceSnippet,
          event,
          timeOrderingSource: orderingSource,
        },
      });
    }

    for (const actor of event.actors) {
      const actorNodeId = toEntityNodeId(actor);
      if (!nodeById.has(actorNodeId)) {
        nodeById.set(actorNodeId, {
          id: actorNodeId,
          type: "default",
          position: { x: 0, y: 0 },
          style: makeNodeStyles("entity"),
          data: {
            kind: "entity",
            label: normalizeEntityLabel(actor),
          },
        });
      }

      const edgeId = makeTimelineEdgeId("actor_to_event", actorNodeId, event.eventId);
      if (!edgeById.has(edgeId)) {
        edgeById.set(edgeId, {
          id: edgeId,
          source: actorNodeId,
          target: event.eventId,
          type: "smoothstep",
          data: { kind: "actor_to_event" },
          label: "acts in",
        });
      }
    }

    for (const target of event.targets ?? []) {
      const targetNodeId = toEntityNodeId(target);
      if (!nodeById.has(targetNodeId)) {
        nodeById.set(targetNodeId, {
          id: targetNodeId,
          type: "default",
          position: { x: 0, y: 0 },
          style: makeNodeStyles("entity"),
          data: {
            kind: "entity",
            label: normalizeEntityLabel(target),
          },
        });
      }

      const edgeId = makeTimelineEdgeId("event_to_target", event.eventId, targetNodeId);
      if (!edgeById.has(edgeId)) {
        edgeById.set(edgeId, {
          id: edgeId,
          source: event.eventId,
          target: targetNodeId,
          type: "smoothstep",
          data: { kind: "event_to_target" },
          label: "affects",
        });
      }
    }
  }

  if (orderedEvents.length > 0) {
    addBoundaryNodes(nodeById);
    const first = orderedEvents[0].event.eventId;
    const last = orderedEvents[orderedEvents.length - 1].event.eventId;

    const startEdgeId = makeTimelineEdgeId("story_boundary", STORY_START_NODE_ID, first);
    edgeById.set(startEdgeId, {
      id: startEdgeId,
      source: STORY_START_NODE_ID,
      target: first,
      type: "straight",
      data: { kind: "story_boundary" },
      label: "begin",
    });

    const endEdgeId = makeTimelineEdgeId("story_boundary", last, STORY_END_NODE_ID);
    edgeById.set(endEdgeId, {
      id: endEdgeId,
      source: last,
      target: STORY_END_NODE_ID,
      type: "straight",
      data: { kind: "story_boundary" },
      label: "end",
    });
  }

  if (options.includeSequenceEdges) {
    for (let index = 0; index < orderedEvents.length - 1; index += 1) {
      const sourceId = orderedEvents[index].event.eventId;
      const targetId = orderedEvents[index + 1].event.eventId;
      const edgeId = makeTimelineEdgeId("event_sequence", sourceId, targetId);
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

  const fallbackOrderCount = orderedEvents.filter(
    (orderedEvent) => orderedEvent.orderingSource === "sequence_fallback",
  ).length;

  const meta: GraphTransformMeta = {
    mode: "timeline",
    relationEdgeCount: 0,
    fallbackOrderCount,
    densityStatus: "ok",
    thresholds: { warn: Number.MAX_SAFE_INTEGER, block: Number.MAX_SAFE_INTEGER },
    droppedEventCount: 0,
  };

  return {
    nodes: Array.from(nodeById.values()),
    edges: Array.from(edgeById.values()),
    meta,
  };
}
