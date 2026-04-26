"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  errorResponseSchema,
  extractEventsResponseSchema,
  type ErrorCode,
  type Event,
  type GraphDiagnostic,
} from "@/lib/contracts";
import { appLimits } from "@/lib/constants";
import { applyDagreLayout } from "@/lib/graph-layout";
import {
  transformEventsToGraph,
  type CharacterEdgeStyle,
  type GraphEdgeData,
  type GraphTransformMeta,
  type GraphViewMode,
  type GraphNodeData,
} from "@/lib/graph-transform";
import type { ResolverResult } from "@/lib/pronoun-resolver";

type UiError = {
  code: ErrorCode | "NETWORK_ERROR";
  message: string;
  requestId?: string;
};

type PreviewStats = ResolverResult["stats"] & {
  skipReason?: ResolverResult["skipReason"] | null;
};

type Theme = "light" | "dark";

export type GraphRenderState = {
  showLargeGraphWarning: boolean;
  blockGraphRender: boolean;
};

const sampleStory = `Aria enters the old fortress and lights a torch.
She discovers a hidden map in a broken chest.
Borin joins Aria and they agree to protect each other.
A shadow beast attacks Borin near the gate.
Aria defends Borin and the beast retreats into the dark.`;

const panelWidths = {
  left: { default: 360, min: 280, max: 480, collapse: 220 },
  right: { default: 400, min: 320, max: 560, collapse: 240 },
  rail: 44,
};

function mapErrorCodeToMessage(code: ErrorCode): string {
  switch (code) {
    case "INVALID_REQUEST":
      return "Story input is invalid. Please review and try again.";
    case "EXTRACTION_FAILED":
      return "The model could not extract events from this story.";
    case "PROVIDER_ERROR":
      return "The LLM provider is unavailable right now. Retry shortly.";
    case "RATE_LIMITED":
      return "The service is busy. Please retry in a few seconds.";
    case "INTERNAL_ERROR":
      return "An internal error occurred while processing this story.";
    default:
      return "Unexpected error while extracting events.";
  }
}

function formatElapsedMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${seconds}s`;
}

export function resolveGraphRenderState(
  graphMode: GraphViewMode,
  eventsCount: number,
  meta: GraphTransformMeta | undefined,
): GraphRenderState {
  const showLargeGraphWarning =
    graphMode === "timeline"
      ? eventsCount > appLimits.largeGraphWarnEvents
      : meta?.densityStatus === "warn";
  const blockGraphRender =
    graphMode === "timeline"
      ? eventsCount > appLimits.largeGraphBlockEvents
      : meta?.densityStatus === "blocked";

  return {
    showLargeGraphWarning,
    blockGraphRender,
  };
}

type GraphControlsProps = {
  graphMode: GraphViewMode;
  characterEdgeStyle: CharacterEdgeStyle;
  includeSequenceEdges: boolean;
  usePronounResolver: boolean;
  layout?: "horizontal" | "vertical" | "panel";
  onGraphModeChange: (mode: GraphViewMode) => void;
  onCharacterEdgeStyleChange: (style: CharacterEdgeStyle) => void;
  onIncludeSequenceEdgesChange: (include: boolean) => void;
  onUsePronounResolverChange: (enabled: boolean) => void;
};

function GraphControls(props: GraphControlsProps) {
  const isVertical = props.layout === "vertical";
  const isPanel = props.layout === "panel";
  const toggleButtonClass = (isActive: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
      isActive
        ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100"
        : "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
    }`;

  if (isPanel) {
    return (
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-zinc-300">Graph View</label>
          <select
            value={props.graphMode}
            onChange={(event) => props.onGraphModeChange(event.target.value as GraphViewMode)}
            className="min-w-32 rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-zinc-200"
            aria-label="Graph mode"
          >
            <option value="timeline">Timeline</option>
            <option value="character">Character</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-zinc-300">Show Sequence Edges</label>
          <button
            type="button"
            role="switch"
            aria-checked={props.includeSequenceEdges}
            disabled={props.graphMode !== "timeline"}
            onClick={() => props.onIncludeSequenceEdgesChange(!props.includeSequenceEdges)}
            className={`relative inline-flex h-5 w-9 items-center border border-white/15 transition ${
              props.includeSequenceEdges ? "bg-indigo-500/40" : "bg-white/10"
            } ${props.graphMode !== "timeline" ? "opacity-50" : ""}`}
          >
            <span
              className={`h-3.5 w-3.5 bg-white transition-transform ${
                props.includeSequenceEdges ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-zinc-300">Character Edge Style</label>
          <select
            value={props.characterEdgeStyle}
            onChange={(event) => props.onCharacterEdgeStyleChange(event.target.value as CharacterEdgeStyle)}
            className="min-w-32 rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-50"
            disabled={props.graphMode !== "character"}
            aria-label="Character edge style"
          >
            <option value="cooccurrence">Co-occurrence</option>
            <option value="action_labeled">Action-labeled</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-zinc-300">Pronoun Resolver</label>
          <button
            type="button"
            role="switch"
            aria-checked={props.usePronounResolver}
            onClick={() => props.onUsePronounResolverChange(!props.usePronounResolver)}
            className={`relative inline-flex h-5 w-9 items-center border border-white/15 transition ${
              props.usePronounResolver ? "bg-indigo-500/40" : "bg-white/10"
            }`}
          >
            <span
              className={`h-3.5 w-3.5 bg-white transition-transform ${
                props.usePronounResolver ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    );
  }

  if (isVertical) {
    return (
      <div className="space-y-3">
        <label className="block space-y-1 text-xs text-zinc-400">
          <span className="uppercase tracking-wide">Graph mode</span>
          <select
            value={props.graphMode}
            onChange={(event) => props.onGraphModeChange(event.target.value as GraphViewMode)}
            className="w-full rounded-lg border border-white/15 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200"
            aria-label="Graph mode"
          >
            <option value="timeline">Timeline</option>
            <option value="character">Character relations</option>
          </select>
        </label>

        <label className="block space-y-1 text-xs text-zinc-400">
          <span className="uppercase tracking-wide">Edge style</span>
          <select
            value={props.characterEdgeStyle}
            onChange={(event) => props.onCharacterEdgeStyleChange(event.target.value as CharacterEdgeStyle)}
            className="w-full rounded-lg border border-white/15 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50"
            disabled={props.graphMode !== "character"}
            aria-label="Character edge style"
          >
            <option value="cooccurrence">Co-occurrence</option>
            <option value="action_labeled">Action-labeled</option>
          </select>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={toggleButtonClass(props.includeSequenceEdges)}
            onClick={() => props.onIncludeSequenceEdgesChange(!props.includeSequenceEdges)}
            aria-pressed={props.includeSequenceEdges}
            disabled={props.graphMode !== "timeline"}
          >
            Sequence edges
          </button>
          <button
            type="button"
            className={toggleButtonClass(props.usePronounResolver)}
            onClick={() => props.onUsePronounResolverChange(!props.usePronounResolver)}
            aria-pressed={props.usePronounResolver}
          >
            Pronoun resolver
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          This affects extraction payloads. Debug preview is separate and does not change request data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-2 text-sm">
          <label className="text-zinc-400">Mode</label>
          <select
            value={props.graphMode}
            onChange={(event) => props.onGraphModeChange(event.target.value as GraphViewMode)}
            className="rounded-lg border border-white/15 bg-zinc-950/80 px-2 py-1 text-sm text-zinc-200"
            aria-label="Graph mode"
          >
            <option value="timeline">Timeline</option>
            <option value="character">Character relations</option>
          </select>

          <label className="text-zinc-400">Edge style</label>
          <select
            value={props.characterEdgeStyle}
            onChange={(event) => props.onCharacterEdgeStyleChange(event.target.value as CharacterEdgeStyle)}
            className="rounded-lg border border-white/15 bg-zinc-950/80 px-2 py-1 text-sm text-zinc-200 disabled:opacity-50"
            disabled={props.graphMode !== "character"}
            aria-label="Character edge style"
          >
            <option value="cooccurrence">Co-occurrence</option>
            <option value="action_labeled">Action-labeled</option>
          </select>

          <button
            type="button"
            className={toggleButtonClass(props.includeSequenceEdges)}
            onClick={() => props.onIncludeSequenceEdgesChange(!props.includeSequenceEdges)}
            aria-pressed={props.includeSequenceEdges}
            disabled={props.graphMode !== "timeline"}
          >
            Sequence edges
          </button>

          <button
            type="button"
            className={toggleButtonClass(props.usePronounResolver)}
            onClick={() => props.onUsePronounResolverChange(!props.usePronounResolver)}
            aria-pressed={props.usePronounResolver}
          >
            Pronoun resolver
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        This affects extraction payloads. Debug preview is separate and does not change request data.
      </p>
    </div>
  );
}

type GraphDiagnosticsProps = {
  requestId?: string;
  eventsCount: number;
  nodesCount: number;
  edgesCount: number;
  meta?: GraphTransformMeta;
  severityFilter: "all" | "error" | "warning";
  categoryFilter: "all" | GraphDiagnostic["category"];
  eventIdToIndex: Map<string, number>;
  onSeverityFilterChange: (value: "all" | "error" | "warning") => void;
  onCategoryFilterChange: (value: "all" | GraphDiagnostic["category"]) => void;
};

function GraphDiagnostics(props: GraphDiagnosticsProps) {
  const diagnostics = props.meta?.diagnostics ?? [];
  const filteredDiagnostics = diagnostics.filter((diagnostic) => {
    const severityMatches =
      props.severityFilter === "all" || diagnostic.severity === props.severityFilter;
    const categoryMatches =
      props.categoryFilter === "all" || diagnostic.category === props.categoryFilter;
    return severityMatches && categoryMatches;
  });

  const errorsCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningsCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;

  const toEventLabel = (eventId: string) => {
    const index = props.eventIdToIndex.get(eventId);
    return index ? `#${index}` : "n/a";
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-2xl border border-white/10 bg-[#0d1425]/90 p-3">
        <div className="inline-flex w-full items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1 text-xs">
          <button
            type="button"
            onClick={() => props.onSeverityFilterChange("all")}
            className={`flex-1 px-2 py-1.5 ${
              props.severityFilter === "all" ? "bg-white/10 text-zinc-100" : "text-zinc-400"
            }`}
          >
            All <span className="ml-1 text-zinc-300">{diagnostics.length}</span>
          </button>
          <button
            type="button"
            onClick={() => props.onSeverityFilterChange("error")}
            className={`flex-1 px-2 py-1.5 ${
              props.severityFilter === "error" ? "bg-red-500/15 text-red-200" : "text-zinc-400"
            }`}
          >
            Errors <span className="ml-1 text-zinc-300">{errorsCount}</span>
          </button>
          <button
            type="button"
            onClick={() => props.onSeverityFilterChange("warning")}
            className={`flex-1 px-2 py-1.5 ${
              props.severityFilter === "warning" ? "bg-amber-500/15 text-amber-200" : "text-zinc-400"
            }`}
          >
            Warnings <span className="ml-1 text-zinc-300">{warningsCount}</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d1425]/90 p-3">
        <p className="mb-2 text-xs font-semibold text-zinc-300">Summary</p>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <p className="rounded-lg border border-white/10 bg-black/20 p-2">
            <span className="block text-base font-semibold text-zinc-100">{props.eventsCount}</span>
            <span className="text-zinc-400">Events</span>
          </p>
          <p className="rounded-lg border border-white/10 bg-black/20 p-2">
            <span className="block text-base font-semibold text-zinc-100">{props.edgesCount}</span>
            <span className="text-zinc-400">Edges</span>
          </p>
          <p className="rounded-lg border border-white/10 bg-black/20 p-2">
            <span className="block text-base font-semibold text-red-300">{props.meta?.diagnosticsSummary.total ?? 0}</span>
            <span className="text-zinc-400">Issues</span>
          </p>
          <p className="rounded-lg border border-white/10 bg-black/20 p-2">
            <span className="block text-base font-semibold text-zinc-100">
              {props.meta?.diagnosticsObservability.runDurationMs
                ? `${(props.meta.diagnosticsObservability.runDurationMs / 1000).toFixed(2)}s`
                : "0.00s"}
            </span>
            <span className="text-zinc-400">Request Time</span>
          </p>
        </div>
      </div>

      <div className="max-h-[430px] space-y-2 overflow-auto rounded-2xl border border-white/10 bg-[#0d1425]/90 p-3">
        <p className="text-xs font-semibold text-zinc-300">Issues</p>
        {filteredDiagnostics.length === 0 ? (
          <p className="text-xs text-zinc-500">No diagnostics for current filters.</p>
        ) : (
          filteredDiagnostics.slice(0, 40).map((diagnostic) => {
            const evidenceEventIds = diagnostic.evidence?.eventIds ?? [];
            const evidenceLabel = evidenceEventIds
              .slice(0, 2)
              .map((eventId) => toEventLabel(eventId))
              .join(" + ");
            return (
              <article
                key={diagnostic.id}
                className={`rounded-xl border p-3 text-xs ${
                  diagnostic.severity === "error"
                    ? "border-red-500/60 bg-red-500/10"
                    : "border-amber-500/60 bg-amber-500/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`font-semibold ${
                      diagnostic.severity === "error" ? "text-red-200" : "text-amber-200"
                    }`}
                  >
                    {diagnostic.category.replace("_", " ")}
                  </p>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wide ${
                      diagnostic.severity === "error" ? "text-red-300" : "text-amber-300"
                    }`}
                  >
                    {diagnostic.severity}
                  </span>
                </div>
                <p className="mt-2 text-zinc-200">{diagnostic.message}</p>
                <p className="mt-2 text-zinc-400">
                  {evidenceLabel ? `Events ${evidenceLabel}` : `Subtype ${diagnostic.subtype}`}
                </p>
              </article>
            );
          })
        )}
      </div>

      <details className="rounded-2xl border border-white/10 bg-[#0d1425]/90 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-300">
          Diagnostics Details
        </summary>
        <div className="mt-2 space-y-1 text-xs text-zinc-300">
          <p>
            requestId: <span className="text-zinc-100">{props.requestId ?? "n/a"}</span>
          </p>
          <p>
            nodes: <span className="text-zinc-100">{props.nodesCount}</span>
          </p>
          <p>
            mode: <span className="text-zinc-100">{props.meta?.mode ?? "n/a"}</span>
          </p>
          <p>
            relationEdges: <span className="text-zinc-100">{props.meta?.relationEdgeCount ?? 0}</span>
          </p>
          <p>
            fallbackOrder: <span className="text-zinc-100">{props.meta?.fallbackOrderCount ?? 0}</span>
          </p>
          <p>
            droppedEvents: <span className="text-zinc-100">{props.meta?.droppedEventCount ?? 0}</span>
          </p>
          <p>
            densityStatus: <span className="text-zinc-100">{props.meta?.densityStatus ?? "ok"}</span>
          </p>
          <p>
            runDurationMs:{" "}
            <span className="text-zinc-100">
              {props.meta?.diagnosticsObservability.runDurationMs ?? 0}
            </span>
          </p>
          <p>
            degradedModeCount:{" "}
            <span className="text-zinc-100">
              {props.meta?.diagnosticsObservability.degradedModeCount ?? 0}
            </span>
          </p>
        </div>
        <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-400">
          <p className="mb-1 font-medium text-zinc-200">Rule hits</p>
          {Object.entries(props.meta?.diagnosticsObservability.perRuleHitCount ?? {}).length === 0 ? (
            <p>n/a</p>
          ) : (
            Object.entries(props.meta?.diagnosticsObservability.perRuleHitCount ?? {})
              .sort((left, right) => right[1] - left[1])
              .slice(0, 8)
              .map(([ruleId, count]) => (
                <p key={ruleId}>
                  {ruleId}: <span className="text-zinc-200">{count}</span>
                </p>
              ))
          )}
        </div>
      </details>
    </div>
  );
}

type TopMetricProps = {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "error";
};

function TopMetric(props: TopMetricProps) {
  const toneClass =
    props.tone === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-100"
      : props.tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
        : "border-white/15 bg-white/5 text-zinc-100";
  return (
    <div className={`rounded-xl border px-2.5 py-1.5 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{props.label}</p>
      <p className="text-xs font-semibold">{props.value}</p>
    </div>
  );
}

function DiagnosticsMetaCard(props: {
  eventsCount: number;
  edgesCount: number;
  issuesCount: number;
  runDurationMs: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">Events</p>
        <p className="text-sm font-semibold text-zinc-100">{props.eventsCount}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">Edges</p>
        <p className="text-sm font-semibold text-zinc-100">{props.edgesCount}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">Issues</p>
        <p className="text-sm font-semibold text-zinc-100">{props.issuesCount}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <p className="text-[10px] uppercase tracking-wide text-zinc-400">Req Time</p>
        <p className="text-sm font-semibold text-zinc-100">{props.runDurationMs}ms</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
    return "dark";
  });
  const [story, setStory] = useState(sampleStory);
  const [events, setEvents] = useState<Event[]>([]);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [includeSequenceEdges, setIncludeSequenceEdges] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphViewMode>("timeline");
  const [characterEdgeStyle, setCharacterEdgeStyle] = useState<CharacterEdgeStyle>("action_labeled");
  const [usePronounResolver, setUsePronounResolver] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeStoryFingerprint, setActiveStoryFingerprint] = useState<string | null>(null);
  const [showResolverDebug, setShowResolverDebug] = useState(false);
  const [resolvedPreview, setResolvedPreview] = useState<string | null>(null);
  const [resolverPreviewStats, setResolverPreviewStats] = useState<PreviewStats | null>(null);
  const [resolverPreviewMessage, setResolverPreviewMessage] = useState<string | null>(null);
  const [resolvingPreview, setResolvingPreview] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<"all" | "error" | "warning">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | GraphDiagnostic["category"]>("all");
  const [leftPanelWidth, setLeftPanelWidth] = useState(panelWidths.left.default);
  const [rightPanelWidth, setRightPanelWidth] = useState(panelWidths.right.default);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [storySectionCollapsed, setStorySectionCollapsed] = useState(false);
  const [graphSettingsSectionCollapsed, setGraphSettingsSectionCollapsed] = useState(true);
  const [advancedSectionCollapsed, setAdvancedSectionCollapsed] = useState(true);
  const [rawEventsSectionCollapsed, setRawEventsSectionCollapsed] = useState(true);
  const [resizeState, setResizeState] = useState<{
    side: "left" | "right";
    startX: number;
    startWidth: number;
  } | null>(null);
  const allowResolverDebug = process.env.NODE_ENV !== "production";
  const diagnosticsEnabled = process.env.NEXT_PUBLIC_STORY_DIAGNOSTICS_PHASE1_ENABLED !== "false";

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resolverModuleRef = useRef<Promise<typeof import("@/lib/pronoun-resolver")> | null>(null);
  const previousHasCompletedAnalysisRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const graph = useMemo(() => {
    const transformed = transformEventsToGraph(events, {
      includeSequenceEdges,
      mode: graphMode,
      characterEdgeStyle,
      enableDiagnostics: diagnosticsEnabled,
    });
    const laidOutNodes = applyDagreLayout(transformed.nodes, transformed.edges, { mode: graphMode });
    return {
      nodes: laidOutNodes,
      edges: transformed.edges,
      meta: transformed.meta,
    };
  }, [events, includeSequenceEdges, graphMode, characterEdgeStyle, diagnosticsEnabled]);

  const { showLargeGraphWarning, blockGraphRender } = resolveGraphRenderState(
    graphMode,
    events.length,
    graph.meta,
  );
  const nodesToRender: Node<GraphNodeData>[] = blockGraphRender ? [] : graph.nodes;
  const edgesToRender: Edge<GraphEdgeData>[] = blockGraphRender ? [] : graph.edges;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    const startedAt = Date.now();
    setElapsedMs(0);
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
  };

  const cancelCurrentRequest = () => {
    abortRef.current?.abort();
  };

  const loadResolverModule = async () => {
    if (!resolverModuleRef.current) {
      resolverModuleRef.current = import("@/lib/pronoun-resolver");
    }

    return resolverModuleRef.current;
  };

  const onGeneratePreview = async () => {
    const normalizedStory = story.trim();
    if (!normalizedStory) {
      setResolverPreviewMessage("Preview unavailable: story is empty.");
      setResolvedPreview(null);
      setResolverPreviewStats(null);
      return;
    }

    if (normalizedStory.length > appLimits.pronounPreviewMaxChars) {
      setResolverPreviewMessage("Preview skipped: input too long.");
      setResolvedPreview(normalizedStory);
      setResolverPreviewStats({
        pronounsFound: 0,
        pronounsResolved: 0,
        pronounsSkipped: 0,
        skipReason: "input_too_long",
      });
      return;
    }

    setResolvingPreview(true);
    setResolverPreviewMessage(null);

    try {
      const resolverModule = await loadResolverModule();
      const result = await resolverModule.resolvePronouns(normalizedStory, {
        maxChars: appLimits.pronounPreviewMaxChars,
      });

      setResolvedPreview(result.resolvedStory);
      setResolverPreviewStats({ ...result.stats, skipReason: result.skipReason ?? null });
      setResolverPreviewMessage(null);
    } catch {
      setResolvedPreview(normalizedStory);
      setResolverPreviewStats({
        pronounsFound: 0,
        pronounsResolved: 0,
        pronounsSkipped: 0,
        skipReason: "model_failure",
      });
      setResolverPreviewMessage("Preview unavailable.");
    } finally {
      setResolvingPreview(false);
    }
  };

  const onSubmit = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const normalizedStory = story.trim();
    const fingerprint = normalizedStory.toLowerCase();

    if (!normalizedStory) {
      setError({
        code: "INVALID_REQUEST",
        message: "Story cannot be empty.",
      });
      return;
    }

    if (normalizedStory.length > appLimits.maxStoryChars) {
      setError({
        code: "INVALID_REQUEST",
        message: `Story exceeds ${appLimits.maxStoryChars.toLocaleString()} characters.`,
      });
      return;
    }

    if (loading && fingerprint === activeStoryFingerprint) {
      return;
    }

    setLoading(true);
    setError(null);
    setRequestId(undefined);
    setActiveStoryFingerprint(fingerprint);
    clearTimer();
    startTimer();

    const controller = new AbortController();
    abortRef.current = controller;
    const browserTimeout = window.setTimeout(() => controller.abort(), appLimits.browserTimeoutMs);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          story: normalizedStory,
          metadata: {
            usePronounResolver,
          },
        }),
        signal: controller.signal,
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const parsedError = errorResponseSchema.safeParse(payload);
        if (parsedError.success) {
          setError({
            code: parsedError.data.error.code,
            message: mapErrorCodeToMessage(parsedError.data.error.code),
            requestId: parsedError.data.requestId,
          });
          setRequestId(parsedError.data.requestId);
          setEvents([]);
          return;
        }

        setError({
          code: "NETWORK_ERROR",
          message: "Received an unexpected error payload from the API.",
        });
        setEvents([]);
        return;
      }

      const parsedResponse = extractEventsResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        setError({
          code: "NETWORK_ERROR",
          message: "Received malformed extraction response from proxy.",
        });
        setEvents([]);
        return;
      }

      setEvents(parsedResponse.data.events);
      setRequestId(parsedResponse.data.requestId);
    } catch {
      setError({
        code: "NETWORK_ERROR",
        message: "Request failed or timed out before completion.",
      });
      setEvents([]);
    } finally {
      window.clearTimeout(browserTimeout);
      clearTimer();
      setLoading(false);
      setActiveStoryFingerprint(null);
      abortRef.current = null;
    }
  };

  const issuesTotal = graph.meta?.diagnosticsSummary.total ?? 0;
  const issuesErrors = graph.meta?.diagnosticsSummary.errors ?? 0;
  const issuesWarnings = graph.meta?.diagnosticsSummary.warnings ?? 0;
  const eventIdToIndex = useMemo(
    () => new Map(events.map((event, index) => [event.eventId, index + 1])),
    [events],
  );
  const hasCompletedAnalysis = requestId !== undefined || error !== null || events.length > 0;

  const clampWidth = (side: "left" | "right", width: number) => {
    const limits = panelWidths[side];
    return Math.min(Math.max(width, limits.min), limits.max);
  };

  useEffect(() => {
    if (!resizeState) {
      return;
    }

    const onResizeMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - resizeState.startX;
      if (resizeState.side === "left") {
        const proposedWidth = resizeState.startWidth + deltaX;
        if (proposedWidth <= panelWidths.left.collapse) {
          setLeftPanelCollapsed(true);
          return;
        }
        setLeftPanelCollapsed(false);
        setLeftPanelWidth(clampWidth("left", proposedWidth));
        return;
      }

      const proposedWidth = resizeState.startWidth - deltaX;
      if (proposedWidth <= panelWidths.right.collapse) {
        setRightPanelCollapsed(true);
        return;
      }
      setRightPanelCollapsed(false);
      setRightPanelWidth(clampWidth("right", proposedWidth));
    };

    const stopResize = () => {
      setResizeState(null);
    };

    window.addEventListener("mousemove", onResizeMouseMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", onResizeMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [resizeState]);

  const startResize = (side: "left" | "right") => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startWidth = side === "left" ? leftPanelWidth : rightPanelWidth;
    setResizeState({
      side,
      startX: event.clientX,
      startWidth,
    });
  };

  const isResizing = resizeState !== null;
  const handleExpandLeft = () => {
    setLeftPanelCollapsed(false);
    setLeftPanelWidth(panelWidths.left.default);
  };
  const handleExpandRight = () => {
    if (!hasCompletedAnalysis) {
      return;
    }
    setRightPanelCollapsed(false);
    setRightPanelWidth(panelWidths.right.default);
  };

  useEffect(() => {
    if (!hasCompletedAnalysis) {
      setRightPanelCollapsed(true);
    }
  }, [hasCompletedAnalysis]);

  useEffect(() => {
    if (!previousHasCompletedAnalysisRef.current && hasCompletedAnalysis) {
      setRightPanelCollapsed(false);
      setRightPanelWidth(panelWidths.right.default);
    }
    previousHasCompletedAnalysisRef.current = hasCompletedAnalysis;
  }, [hasCompletedAnalysis]);

  return (
    <main className={`ui-shell min-h-screen text-zinc-100 ${isResizing ? "select-none lg:cursor-col-resize" : ""}`}>
      <div className="w-full space-y-2 p-3 lg:h-screen lg:max-h-screen lg:overflow-hidden">
        <header className="-mx-3 -mt-3 px-4 py-2 shadow-[0_16px_40px_-30px_rgba(59,130,246,0.7)] lg:px-5 lg:py-2">
          <div className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
            <div className="flex min-w-max items-center gap-3">
              <h1 className="text-lg font-semibold">Narrative Consistency Checker</h1>
              <button
                type="button"
                className="theme-toggle px-2.5 py-1 text-[11px] font-medium"
                onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? "Switch to Dark" : "Switch to Light"}
              </button>
            </div>
            <div className="grid min-w-max grid-cols-4 gap-2">
              <TopMetric label="Last run" value={loading ? formatElapsedMs(elapsedMs) : "Ready"} />
              <TopMetric label="Events" value={String(events.length)} />
              <TopMetric label="Issues" value={String(issuesTotal)} tone={issuesErrors > 0 ? "error" : "neutral"} />
              <TopMetric
                label="Warnings"
                value={String(issuesWarnings)}
                tone={issuesWarnings > 0 ? "warning" : "neutral"}
              />
            </div>
          </div>
        </header>

        <div className="grid gap-3 lg:h-[calc(100%-96px)] lg:grid-cols-1 lg:overflow-hidden">
          <div className="flex h-full gap-2 overflow-hidden">
            {leftPanelCollapsed ? (
              <div
                className="hidden h-full items-center justify-center rounded-2xl border border-white/10 bg-[#0d1425]/90 lg:flex"
                style={{ width: panelWidths.rail }}
              >
                <button
                  type="button"
                  onClick={handleExpandLeft}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
                  aria-label="Expand left section"
                >
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <section className="overflow-auto pr-1" style={{ width: leftPanelWidth }}>
                <div className="rounded-2xl border border-white/10 bg-[#0d1425]/90 shadow-[0_16px_30px_-20px_rgba(59,130,246,0.5)]">
                  <div className="border-b border-white/10 p-3">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-100">Story Input</h2>
                        <p className="text-xs text-zinc-400">Paste your story below. We&apos;ll extract events and build the graph.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStorySectionCollapsed((current) => !current)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
                        aria-label={`${storySectionCollapsed ? "Expand" : "Collapse"} story input section`}
                      >
                        <svg
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className={`h-4 w-4 transition-transform ${storySectionCollapsed ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    {storySectionCollapsed ? null : (
                      <form className="space-y-3" onSubmit={onSubmit}>
                        <textarea
                          id="story-input"
                          className="h-56 w-full rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-sm"
                          value={story}
                          onChange={(event) => setStory(event.target.value)}
                          maxLength={appLimits.maxStoryChars}
                        />
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span>{story.trim().length.toLocaleString()} characters</span>
                          {loading ? <span>{formatElapsedMs(elapsedMs)}</span> : null}
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-900/50 disabled:opacity-50"
                        >
                          {loading ? "Analyzing..." : "Analyze Story"}
                        </button>
                        {loading ? (
                          <button
                            type="button"
                            onClick={cancelCurrentRequest}
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-1.5 text-sm"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </form>
                    )}
                  </div>

                  <div className="border-b border-white/10 p-3">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-100">Graph Settings</h2>
                        <p className="text-xs text-zinc-400">Configure rendering options.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGraphSettingsSectionCollapsed((current) => !current)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
                        aria-label={`${graphSettingsSectionCollapsed ? "Expand" : "Collapse"} graph settings section`}
                      >
                        <svg
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className={`h-4 w-4 transition-transform ${graphSettingsSectionCollapsed ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    {graphSettingsSectionCollapsed ? null : (
                      <GraphControls
                        graphMode={graphMode}
                        characterEdgeStyle={characterEdgeStyle}
                        includeSequenceEdges={includeSequenceEdges}
                        usePronounResolver={usePronounResolver}
                        layout="panel"
                        onGraphModeChange={setGraphMode}
                        onCharacterEdgeStyleChange={setCharacterEdgeStyle}
                        onIncludeSequenceEdgesChange={setIncludeSequenceEdges}
                        onUsePronounResolverChange={setUsePronounResolver}
                      />
                    )}
                  </div>

                  <div className="border-b border-white/10 p-3">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-100">Advanced (Debug)</h2>
                        <p className="text-xs text-zinc-400">Developer debug tools and previews.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdvancedSectionCollapsed((current) => !current)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
                        aria-label={`${advancedSectionCollapsed ? "Expand" : "Collapse"} advanced section`}
                      >
                        <svg
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className={`h-4 w-4 transition-transform ${advancedSectionCollapsed ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    {advancedSectionCollapsed ? null : (
                      <>
                        <DiagnosticsMetaCard
                          eventsCount={events.length}
                          edgesCount={graph.edges.length}
                          issuesCount={issuesTotal}
                          runDurationMs={graph.meta?.diagnosticsObservability.runDurationMs ?? 0}
                        />
                        {allowResolverDebug ? (
                          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                            <label className="flex items-center gap-2 text-sm text-zinc-200">
                              <input
                                type="checkbox"
                                checked={showResolverDebug}
                                onChange={(event) => setShowResolverDebug(event.target.checked)}
                              />
                              Debug: Pronoun resolver preview
                            </label>

                            {showResolverDebug ? (
                              <>
                                <p className="mt-3 text-xs uppercase tracking-wide text-zinc-400">Preview only</p>
                                <p className="mt-1 text-zinc-300">
                                  This preview does not change the extract request payload.
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={onGeneratePreview}
                                    disabled={resolvingPreview}
                                    className="rounded-lg border border-white/15 px-3 py-1 text-xs disabled:opacity-50"
                                  >
                                    {resolvingPreview ? "Generating preview..." : "Generate Preview"}
                                  </button>
                                  <span className="text-xs text-zinc-500">
                                    max {appLimits.pronounPreviewMaxChars.toLocaleString()} chars
                                  </span>
                                </div>

                                {resolverPreviewMessage ? (
                                  <p className="mt-2 text-xs text-amber-300">{resolverPreviewMessage}</p>
                                ) : null}

                                <div className="mt-3 grid gap-2">
                                  <div>
                                    <p className="text-xs text-zinc-500">Original story</p>
                                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-black p-2 text-xs text-zinc-300">
                                      {story.trim() || "n/a"}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="text-xs text-zinc-500">Resolved preview story</p>
                                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-black p-2 text-xs text-zinc-300">
                                      {resolvedPreview ?? "Run Generate Preview"}
                                    </pre>
                                  </div>
                                  <div className="rounded border border-white/10 bg-zinc-900/80 p-2 text-xs">
                                    <p>pronounsFound: {resolverPreviewStats?.pronounsFound ?? 0}</p>
                                    <p>pronounsResolved: {resolverPreviewStats?.pronounsResolved ?? 0}</p>
                                    <p>pronounsSkipped: {resolverPreviewStats?.pronounsSkipped ?? 0}</p>
                                    <p>
                                      skipReason:{" "}
                                      {resolverPreviewStats ? (resolverPreviewStats.skipReason ?? "null") : "n/a"}
                                    </p>
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        {error ? (
                          <div className="mt-3 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm">
                            <p className="font-medium text-red-200">Error ({error.code})</p>
                            <p className="mt-1 text-zinc-200">{error.message}</p>
                            {error.requestId ? <p className="mt-1 text-xs">requestId: {error.requestId}</p> : null}
                          </div>
                        ) : null}
                        {showLargeGraphWarning ? (
                          <p className="mt-3 text-sm text-amber-300">
                            {graphMode === "timeline"
                              ? `Large graph warning: ${events.length} events may impact rendering performance.`
                              : `Character graph warning: relation edges are above ${graph.meta?.thresholds.warn ?? appLimits.characterGraphWarnEdges}.`}
                          </p>
                        ) : null}
                        {blockGraphRender ? (
                          <p className="mt-2 text-sm text-amber-200">
                            {graphMode === "timeline"
                              ? `Graph rendering disabled above ${appLimits.largeGraphBlockEvents} events. Reduce input or improve extraction granularity.`
                              : `Character graph rendering disabled above ${graph.meta?.thresholds.block ?? appLimits.characterGraphBlockEdges} relation edges.`}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-100">Raw Events</h2>
                        <p className="text-xs text-zinc-400">Inspect extracted events payload.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRawEventsSectionCollapsed((current) => !current)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
                        aria-label={`${rawEventsSectionCollapsed ? "Expand" : "Collapse"} raw events section`}
                      >
                        <svg
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className={`h-4 w-4 transition-transform ${rawEventsSectionCollapsed ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    {rawEventsSectionCollapsed ? null : (
                      <pre className="max-h-64 overflow-auto rounded-lg bg-black/60 p-3 text-xs text-zinc-300">
                        {JSON.stringify(events, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </section>
            )}

            {!leftPanelCollapsed ? (
              <button
                type="button"
                onMouseDown={startResize("left")}
                className="hidden w-2 cursor-col-resize rounded-full border border-white/10 bg-white/5 lg:block"
                aria-label="Resize left section"
              />
            ) : null}

            <section className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0d1425]/90 p-2.5 lg:overflow-hidden">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-semibold">Event Graph</h2>
                <p className="text-xs text-zinc-400">
                  Timeline view of events. Red indicates inconsistencies.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
                  {graphMode === "timeline" ? "Timeline" : "Character"}
                </div>
              </div>
            </div>
            <div className="h-[500px] rounded-xl border border-white/10 bg-black/25 lg:h-[calc(100%-42px)]">
              {blockGraphRender ? (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  Graph hidden due to event volume.
                </div>
              ) : (
                <ReactFlow
                  fitView
                  onlyRenderVisibleElements
                  nodes={nodesToRender}
                  edges={edgesToRender}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  minZoom={0.2}
                  maxZoom={1.5}
                >
                  <Controls />
                  <Background />
                </ReactFlow>
              )}
            </div>
            </section>

            {!rightPanelCollapsed && hasCompletedAnalysis ? (
              <button
                type="button"
                onMouseDown={startResize("right")}
                className="hidden w-2 cursor-col-resize rounded-full border border-white/10 bg-white/5 lg:block"
                aria-label="Resize right section"
              />
            ) : null}

            {rightPanelCollapsed ? (
              <div
                className="hidden h-full items-center justify-center rounded-2xl border border-white/10 bg-[#0d1425]/90 lg:flex"
                style={{ width: panelWidths.rail }}
              >
                <button
                  type="button"
                  onClick={handleExpandRight}
                  disabled={!hasCompletedAnalysis}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200 disabled:opacity-50"
                  aria-label="Expand right section"
                >
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <aside
                className="space-y-3 rounded-2xl border border-white/10 bg-[#0d1425]/90 p-3 overflow-auto"
                style={{ width: rightPanelWidth }}
              >
                <div>
                  <div>
                    <h2 className="text-lg font-semibold">Diagnostics</h2>
                    <p className="text-xs text-zinc-400">Issues and quality insights about your story</p>
                  </div>
                </div>
                <GraphDiagnostics
                  requestId={requestId}
                  eventsCount={events.length}
                  nodesCount={graph.nodes.length}
                  edgesCount={graph.edges.length}
                  meta={graph.meta}
                  severityFilter={severityFilter}
                  categoryFilter={categoryFilter}
                  eventIdToIndex={eventIdToIndex}
                  onSeverityFilterChange={setSeverityFilter}
                  onCategoryFilterChange={setCategoryFilter}
                />
              </aside>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
