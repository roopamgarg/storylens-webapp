import type { Edge, Node } from "@xyflow/react";

import type { Event } from "@/lib/contracts";
import { appLimits } from "@/lib/constants";

import {
  classifyDensity,
  DIAGNOSTICS_SCHEMA_VERSION,
  lexicalCompare,
  type CharacterEdgeStyle,
  type GraphEdgeData,
  type GraphNodeData,
  type GraphTransformMeta,
  type GraphTransformResult,
  makeNodeStyles,
  normalizeEntityLabel,
  toEntityNodeId,
} from "./shared";

function createEntityNode(id: string, label: string): Node<GraphNodeData> {
  return {
    id,
    type: "default",
    position: { x: 0, y: 0 },
    style: makeNodeStyles("entity"),
    data: {
      kind: "entity",
      label,
    },
  };
}

function pairKey(left: string, right: string): string {
  return [left, right].sort(lexicalCompare).join("|");
}

export function transformCharacterGraph(
  events: Event[],
  style: CharacterEdgeStyle,
): GraphTransformResult {
  const nodeById = new Map<string, Node<GraphNodeData>>();
  const edgeById = new Map<string, Edge<GraphEdgeData>>();
  let droppedEventCount = 0;

  for (const event of events) {
    const actors = event.actors.map((actor) => ({ id: toEntityNodeId(actor), label: normalizeEntityLabel(actor) }));
    const targets = (event.targets ?? []).map((target) => ({
      id: toEntityNodeId(target),
      label: normalizeEntityLabel(target),
    }));

    for (const entity of [...actors, ...targets]) {
      if (!nodeById.has(entity.id)) {
        nodeById.set(entity.id, createEntityNode(entity.id, entity.label));
      }
    }

    if (style === "cooccurrence") {
      const uniqueEntityIds = Array.from(new Set([...actors, ...targets].map((entity) => entity.id))).sort(
        lexicalCompare,
      );
      if (uniqueEntityIds.length < 2) {
        droppedEventCount += 1;
        continue;
      }

      for (let sourceIndex = 0; sourceIndex < uniqueEntityIds.length - 1; sourceIndex += 1) {
        for (
          let targetIndex = sourceIndex + 1;
          targetIndex < uniqueEntityIds.length;
          targetIndex += 1
        ) {
          const source = uniqueEntityIds[sourceIndex];
          const target = uniqueEntityIds[targetIndex];
          const key = pairKey(source, target);
          const edgeId = `cooccurrence:${key}`;
          const existing = edgeById.get(edgeId);
          if (existing && existing.data && existing.data.kind === "cooccurrence") {
            const nextCount = existing.data.count + 1;
            edgeById.set(edgeId, {
              ...existing,
              data: {
                kind: "cooccurrence",
                count: nextCount,
              },
              label: `co-occurs (${nextCount})`,
            });
          } else {
            edgeById.set(edgeId, {
              id: edgeId,
              source,
              target,
              type: "smoothstep",
              data: {
                kind: "cooccurrence",
                count: 1,
              },
              label: "co-occurs (1)",
            });
          }
        }
      }
      continue;
    }

    if (actors.length === 0 || targets.length === 0) {
      droppedEventCount += 1;
      continue;
    }

    for (const actor of actors) {
      for (const target of targets) {
        const edgeId = `action_labeled:${event.action}:${actor.id}->${target.id}`;
        if (!edgeById.has(edgeId)) {
          edgeById.set(edgeId, {
            id: edgeId,
            source: actor.id,
            target: target.id,
            type: "straight",
            data: {
              kind: "action_labeled",
              action: event.action,
            },
            label: event.action,
          });
        }
      }
    }
  }

  const relationEdgeCount = edgeById.size;
  const thresholds = {
    warn: appLimits.characterGraphWarnEdges,
    block: appLimits.characterGraphBlockEdges,
  };

  const meta: GraphTransformMeta = {
    diagnosticsSchemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    mode: "character",
    characterEdgeStyle: style,
    relationEdgeCount,
    fallbackOrderCount: 0,
    densityStatus: classifyDensity(relationEdgeCount, thresholds),
    thresholds,
    droppedEventCount,
    diagnostics: [],
    diagnosticsSummary: { total: 0, errors: 0, warnings: 0 },
    diagnosticsObservability: {
      runDurationMs: 0,
      perRuleHitCount: {},
      degradedModeCount: 0,
    },
    ruleReadiness: [],
  };

  return {
    nodes: Array.from(nodeById.values()),
    edges: Array.from(edgeById.values()),
    meta,
  };
}
