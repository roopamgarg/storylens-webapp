import type { Event } from "@/lib/contracts";
import type { GraphDiagnostic } from "@/lib/contracts";

import { transformCharacterGraph } from "@/lib/graph-transform/character";
import {
  DIAGNOSTICS_SCHEMA_VERSION,
  type CharacterEdgeStyle,
  type GraphEdgeData,
  type GraphEdgeKind,
  type GraphNodeData,
  type GraphNodeKind,
  makeNodeStyles,
  type RuleReadinessEntry,
  type GraphTransformMeta,
  type GraphTransformOptions,
  type GraphTransformResult,
  type GraphViewMode,
  type TimeOrderingSource,
} from "@/lib/graph-transform/shared";
import { detectStoryDiagnostics, summarizeDiagnostics } from "@/lib/story-diagnostics";
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

const diagnosticsRuleReadiness: RuleReadinessEntry[] = [
  {
    ruleId: "timeline.missing_temporal_edge",
    requiredSignals: ["event_order", "sequence_edge_setting"],
    degradedModeBehavior: "emit warning only",
    enabled: true,
  },
  {
    ruleId: "timeline.simultaneity_conflict",
    requiredSignals: ["timeHint", "location", "actors"],
    degradedModeBehavior: "downgrade to warning when time confidence is low",
    enabled: true,
  },
  {
    ruleId: "spatial.location_transition_missing",
    requiredSignals: ["ordered events", "location", "actors"],
    degradedModeBehavior: "skip when location missing",
    enabled: true,
  },
  {
    ruleId: "causality.missing_cause",
    requiredSignals: ["ordered events", "actors|targets", "action"],
    degradedModeBehavior: "emit warning only",
    enabled: true,
  },
  {
    ruleId: "missing_links.missing_interaction",
    requiredSignals: ["event components", "entity overlap"],
    degradedModeBehavior: "emit warning only",
    enabled: true,
  },
  {
    ruleId: "redundancy.duplicate_event",
    requiredSignals: ["event signature"],
    degradedModeBehavior: "skip when sourceText unavailable",
    enabled: true,
  },
  {
    ruleId: "dependency.dependency_reversed",
    requiredSignals: ["item targets", "sourceText usage cues"],
    degradedModeBehavior: "emit warning only",
    enabled: true,
  },
];

function emitDiagnosticsTelemetry(
  run: {
    diagnostics: GraphDiagnostic[];
    runDurationMs: number;
    perRuleHitCount: Record<string, number>;
    degradedModeCount: number;
  },
  enabled: boolean,
): void {
  const payload = {
    event: "story_diagnostics_run",
    enabled,
    durationMs: run.runDurationMs,
    diagnosticsCount: run.diagnostics.length,
    errorCount: run.diagnostics.filter((item) => item.severity === "error").length,
    warningCount: run.diagnostics.filter((item) => item.severity === "warning").length,
    degradedModeCount: run.degradedModeCount,
  };
  if (process.env.NODE_ENV !== "test") {
    console.info(JSON.stringify(payload));
    for (const [ruleId, firedCount] of Object.entries(run.perRuleHitCount)) {
      console.info(
        JSON.stringify({
          event: "story_diagnostics_rule_hit",
          ruleId,
          severity:
            run.diagnostics.find(
              (diagnostic) => `${diagnostic.category}.${diagnostic.subtype}` === ruleId,
            )?.severity ?? "warning",
          fired: firedCount > 0,
          suppressed: false,
          durationMs: run.runDurationMs,
        }),
      );
    }
  }
}

function applyDiagnosticHighlighting(
  graph: GraphTransformResult,
  diagnostics: GraphDiagnostic[],
): GraphTransformResult {
  if (diagnostics.length === 0) {
    return graph;
  }

  const nodeSeverityById = new Map<string, "error" | "warning">();
  const edgeSeverityById = new Map<string, "error" | "warning">();
  const nodeDiagnosticIds = new Map<string, string[]>();

  const severityRank = (severity: "error" | "warning") => (severity === "error" ? 2 : 1);

  for (const diagnostic of diagnostics) {
    for (const nodeId of diagnostic.nodeIds ?? []) {
      const current = nodeSeverityById.get(nodeId);
      if (!current || severityRank(diagnostic.severity) > severityRank(current)) {
        nodeSeverityById.set(nodeId, diagnostic.severity);
      }
      const existingIds = nodeDiagnosticIds.get(nodeId) ?? [];
      if (!existingIds.includes(diagnostic.id)) {
        existingIds.push(diagnostic.id);
      }
      nodeDiagnosticIds.set(nodeId, existingIds);
    }
    for (const edgeId of diagnostic.edgeIds ?? []) {
      const current = edgeSeverityById.get(edgeId);
      if (!current || severityRank(diagnostic.severity) > severityRank(current)) {
        edgeSeverityById.set(edgeId, diagnostic.severity);
      }
    }
  }

  const nodes = graph.nodes.map((node) => {
    const severity = nodeSeverityById.get(node.id);
    if (!severity) {
      return node;
    }
    return {
      ...node,
      style: makeNodeStyles(node.data.kind, severity),
      data: {
        ...node.data,
        diagnosticSeverity: severity,
        diagnosticIds: nodeDiagnosticIds.get(node.id) ?? [],
      },
    };
  });

  const edges = graph.edges.map((edge) => {
    const severity = edgeSeverityById.get(edge.id);
    if (!severity) {
      return edge;
    }
    return {
      ...edge,
      style:
        severity === "error"
          ? { ...(edge.style ?? {}), stroke: "#dc2626", strokeWidth: 2.25 }
          : { ...(edge.style ?? {}), stroke: "#d97706", strokeWidth: 2 },
    };
  });

  return { ...graph, nodes, edges };
}

function enrichMeta(
  graph: GraphTransformResult,
  diagnostics: GraphDiagnostic[],
  observability: {
    runDurationMs: number;
    perRuleHitCount: Record<string, number>;
    degradedModeCount: number;
  },
  mode: GraphViewMode,
): GraphTransformMeta {
  const baseMeta: GraphTransformMeta = graph.meta ?? {
    diagnosticsSchemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    mode,
    relationEdgeCount: 0,
    fallbackOrderCount: 0,
    densityStatus: "ok",
    thresholds: { warn: Number.MAX_SAFE_INTEGER, block: Number.MAX_SAFE_INTEGER },
    droppedEventCount: 0,
    diagnostics: [],
    diagnosticsSummary: { total: 0, errors: 0, warnings: 0 },
    diagnosticsObservability: {
      runDurationMs: 0,
      perRuleHitCount: {},
      degradedModeCount: 0,
    },
    ruleReadiness: diagnosticsRuleReadiness,
  };

  return {
    ...baseMeta,
    diagnosticsSchemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
    diagnostics,
    diagnosticsSummary: summarizeDiagnostics(diagnostics),
    diagnosticsObservability: observability,
    ruleReadiness: diagnosticsRuleReadiness,
  };
}

export function transformEventsToGraph(
  events: Event[],
  options: GraphTransformOptions = {},
): GraphTransformResult {
  const mode = options.mode ?? "timeline";
  const diagnosticsEnabled = options.enableDiagnostics ?? true;
  const includeSequenceEdges = options.includeSequenceEdges ?? false;
  if (mode === "character") {
    const style: CharacterEdgeStyle = options.characterEdgeStyle ?? "cooccurrence";
    let graph = transformCharacterGraph(events, style);
    const diagnosticsRun = diagnosticsEnabled
      ? detectStoryDiagnostics({
          events,
          includeSequenceEdges,
        })
      : { diagnostics: [], runDurationMs: 0, perRuleHitCount: {}, degradedModeCount: 0 };
    emitDiagnosticsTelemetry(diagnosticsRun, diagnosticsEnabled);
    graph = applyDiagnosticHighlighting(graph, diagnosticsRun.diagnostics);
    return {
      ...graph,
      meta: enrichMeta(graph, diagnosticsRun.diagnostics, diagnosticsRun, mode),
    };
  }

  let graph = transformTimelineGraph(events, {
    includeSequenceEdges,
  });
  const diagnosticsRun = diagnosticsEnabled
    ? detectStoryDiagnostics({
        events,
        includeSequenceEdges,
      })
    : { diagnostics: [], runDurationMs: 0, perRuleHitCount: {}, degradedModeCount: 0 };
  emitDiagnosticsTelemetry(diagnosticsRun, diagnosticsEnabled);
  graph = applyDiagnosticHighlighting(graph, diagnosticsRun.diagnostics);
  return {
    ...graph,
    meta: enrichMeta(graph, diagnosticsRun.diagnostics, diagnosticsRun, mode),
  };
}
