"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  errorResponseSchema,
  extractEventsResponseSchema,
  type ErrorCode,
  type Event,
  type GraphDiagnostic,
} from "@/lib/contracts";
import { GraphPanel } from "@/app/components/story-checker/GraphPanel";
import { LeftControlPanel } from "@/app/components/story-checker/LeftControlPanel";
import { MainHeader } from "@/app/components/story-checker/MainHeader";
import { RightDiagnosticsPanel } from "@/app/components/story-checker/RightDiagnosticsPanel";
import type { UiError, PreviewStats } from "@/app/components/story-checker/types";
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
  right: { default: 340, min: 300, max: 520, collapse: 220 },
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


export default function Home() {
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
  const rightPanelIsCollapsed = !hasCompletedAnalysis || rightPanelCollapsed;

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
        <MainHeader
          loading={loading}
          elapsedLabel={formatElapsedMs(elapsedMs)}
          eventsCount={events.length}
          issuesTotal={issuesTotal}
          issuesErrors={issuesErrors}
          issuesWarnings={issuesWarnings}
        />

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
              <LeftControlPanel
                width={leftPanelWidth}
                story={story}
                loading={loading}
                elapsedLabel={formatElapsedMs(elapsedMs)}
                graphMode={graphMode}
                characterEdgeStyle={characterEdgeStyle}
                includeSequenceEdges={includeSequenceEdges}
                usePronounResolver={usePronounResolver}
                showResolverDebug={showResolverDebug}
                resolvingPreview={resolvingPreview}
                resolvedPreview={resolvedPreview}
                resolverPreviewStats={resolverPreviewStats}
                resolverPreviewMessage={resolverPreviewMessage}
                allowResolverDebug={allowResolverDebug}
                error={error}
                showLargeGraphWarning={showLargeGraphWarning}
                blockGraphRender={blockGraphRender}
                eventsCount={events.length}
                graphEdgesCount={graph.edges.length}
                issuesTotal={issuesTotal}
                graphMeta={graph.meta}
                rawEventsJson={JSON.stringify(events, null, 2)}
                storySectionCollapsed={storySectionCollapsed}
                graphSettingsSectionCollapsed={graphSettingsSectionCollapsed}
                advancedSectionCollapsed={advancedSectionCollapsed}
                rawEventsSectionCollapsed={rawEventsSectionCollapsed}
                onToggleStorySection={() => setStorySectionCollapsed((current) => !current)}
                onToggleGraphSettingsSection={() => setGraphSettingsSectionCollapsed((current) => !current)}
                onToggleAdvancedSection={() => setAdvancedSectionCollapsed((current) => !current)}
                onToggleRawEventsSection={() => setRawEventsSectionCollapsed((current) => !current)}
                onStoryChange={setStory}
                onSubmit={onSubmit}
                onCancelRequest={cancelCurrentRequest}
                onGraphModeChange={setGraphMode}
                onCharacterEdgeStyleChange={setCharacterEdgeStyle}
                onIncludeSequenceEdgesChange={setIncludeSequenceEdges}
                onUsePronounResolverChange={setUsePronounResolver}
                onToggleResolverDebug={setShowResolverDebug}
                onGeneratePreview={onGeneratePreview}
              />
            )}

            {!leftPanelCollapsed ? (
              <button
                type="button"
                onMouseDown={startResize("left")}
                className="hidden w-2 cursor-col-resize rounded-full border border-white/10 bg-white/5 lg:block"
                aria-label="Resize left section"
              />
            ) : null}

            <GraphPanel
              graphMode={graphMode}
              blockGraphRender={blockGraphRender}
              nodesToRender={nodesToRender}
              edgesToRender={edgesToRender}
            />

            {!rightPanelIsCollapsed && hasCompletedAnalysis ? (
              <button
                type="button"
                onMouseDown={startResize("right")}
                className="hidden w-2 cursor-col-resize rounded-full border border-white/10 bg-white/5 lg:block"
                aria-label="Resize right section"
              />
            ) : null}

            <RightDiagnosticsPanel
              collapsed={rightPanelIsCollapsed}
              railWidth={panelWidths.rail}
              width={rightPanelWidth}
              hasCompletedAnalysis={hasCompletedAnalysis}
              requestId={requestId}
              events={events}
              graphNodesCount={graph.nodes.length}
              graphEdgesCount={graph.edges.length}
              meta={graph.meta}
              severityFilter={severityFilter}
              categoryFilter={categoryFilter}
              eventIdToIndex={eventIdToIndex}
              onExpand={handleExpandRight}
              onSeverityFilterChange={setSeverityFilter}
              onCategoryFilterChange={setCategoryFilter}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
