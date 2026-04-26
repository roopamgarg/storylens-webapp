"use client";

import { useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
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

export type GraphRenderState = {
  showLargeGraphWarning: boolean;
  blockGraphRender: boolean;
};

const sampleStory = `Aria enters the old fortress and lights a torch.
She discovers a hidden map in a broken chest.
Borin joins Aria and they agree to protect each other.
A shadow beast attacks Borin near the gate.
Aria defends Borin and the beast retreats into the dark.`;

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
  showResolverDebug: boolean;
  allowResolverDebug: boolean;
  onGraphModeChange: (mode: GraphViewMode) => void;
  onCharacterEdgeStyleChange: (style: CharacterEdgeStyle) => void;
  onIncludeSequenceEdgesChange: (include: boolean) => void;
  onUsePronounResolverChange: (enabled: boolean) => void;
  onShowResolverDebugChange: (show: boolean) => void;
};

function GraphControls(props: GraphControlsProps) {
  return (
    <div className="space-y-3">
      <fieldset className="rounded border border-zinc-800 p-2">
        <legend className="px-1 text-xs text-zinc-400">Graph mode</legend>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="graph-mode"
              value="timeline"
              checked={props.graphMode === "timeline"}
              onChange={() => props.onGraphModeChange("timeline")}
            />
            Timeline
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="graph-mode"
              value="character"
              checked={props.graphMode === "character"}
              onChange={() => props.onGraphModeChange("character")}
            />
            Character relations
          </label>
        </div>
      </fieldset>

      {props.graphMode === "timeline" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={props.includeSequenceEdges}
            onChange={(event) => props.onIncludeSequenceEdgesChange(event.target.checked)}
          />
          Include sequence edges
        </label>
      ) : null}

      {props.graphMode === "character" ? (
        <label className="flex items-center gap-2 text-sm">
          <span>Edge style:</span>
          <select
            value={props.characterEdgeStyle}
            onChange={(event) => props.onCharacterEdgeStyleChange(event.target.value as CharacterEdgeStyle)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          >
            <option value="cooccurrence">Co-occurrence</option>
            <option value="action_labeled">Action-labeled</option>
          </select>
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={props.usePronounResolver}
          onChange={(event) => props.onUsePronounResolverChange(event.target.checked)}
        />
        Use pronoun-resolved story for extraction
      </label>
      <p className="text-xs text-zinc-500">
        This affects extraction payloads. Debug preview is separate and does not change request data.
      </p>

      {props.allowResolverDebug ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={props.showResolverDebug}
            onChange={(event) => props.onShowResolverDebugChange(event.target.checked)}
          />
          Debug: Pronoun resolver preview
        </label>
      ) : null}
    </div>
  );
}

type GraphDiagnosticsProps = {
  requestId?: string;
  eventsCount: number;
  nodesCount: number;
  edgesCount: number;
  meta?: GraphTransformMeta;
};

function GraphDiagnostics(props: GraphDiagnosticsProps) {
  return (
    <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
      <p>
        requestId: <span className="text-zinc-300">{props.requestId ?? "n/a"}</span>
      </p>
      <p>
        events: <span className="text-zinc-300">{props.eventsCount}</span>
      </p>
      <p>
        nodes: <span className="text-zinc-300">{props.nodesCount}</span>
      </p>
      <p>
        edges: <span className="text-zinc-300">{props.edgesCount}</span>
      </p>
      <p>
        mode: <span className="text-zinc-300">{props.meta?.mode ?? "n/a"}</span>
      </p>
      <p>
        style: <span className="text-zinc-300">{props.meta?.characterEdgeStyle ?? "n/a"}</span>
      </p>
      <p>
        relationEdges: <span className="text-zinc-300">{props.meta?.relationEdgeCount ?? 0}</span>
      </p>
      <p>
        fallbackOrder: <span className="text-zinc-300">{props.meta?.fallbackOrderCount ?? 0}</span>
      </p>
      <p>
        droppedEvents: <span className="text-zinc-300">{props.meta?.droppedEventCount ?? 0}</span>
      </p>
      <p>
        densityStatus: <span className="text-zinc-300">{props.meta?.densityStatus ?? "ok"}</span>
      </p>
    </div>
  );
}

export default function Home() {
  const [story, setStory] = useState(sampleStory);
  const [events, setEvents] = useState<Event[]>([]);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [includeSequenceEdges, setIncludeSequenceEdges] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphViewMode>("timeline");
  const [characterEdgeStyle, setCharacterEdgeStyle] = useState<CharacterEdgeStyle>("cooccurrence");
  const [usePronounResolver, setUsePronounResolver] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeStoryFingerprint, setActiveStoryFingerprint] = useState<string | null>(null);
  const [showResolverDebug, setShowResolverDebug] = useState(false);
  const [resolvedPreview, setResolvedPreview] = useState<string | null>(null);
  const [resolverPreviewStats, setResolverPreviewStats] = useState<PreviewStats | null>(null);
  const [resolverPreviewMessage, setResolverPreviewMessage] = useState<string | null>(null);
  const [resolvingPreview, setResolvingPreview] = useState(false);
  const allowResolverDebug = process.env.NODE_ENV !== "production";

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resolverModuleRef = useRef<Promise<typeof import("@/lib/pronoun-resolver")> | null>(null);

  const graph = useMemo(() => {
    const transformed = transformEventsToGraph(events, {
      includeSequenceEdges,
      mode: graphMode,
      characterEdgeStyle,
    });
    const laidOutNodes = applyDagreLayout(transformed.nodes, transformed.edges, { mode: graphMode });
    return {
      nodes: laidOutNodes,
      edges: transformed.edges,
      meta: transformed.meta,
    };
  }, [events, includeSequenceEdges, graphMode, characterEdgeStyle]);

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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4 lg:h-screen lg:flex-row">
        <section className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-4 lg:w-[420px] lg:overflow-auto">
          <h1 className="text-xl font-semibold">Narrative Graph Tester</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Submit story text, extract events via the LLM layer, and render an event graph.
          </p>

          <form className="mt-4 space-y-3" onSubmit={onSubmit}>
            <label className="block text-sm font-medium" htmlFor="story-input">
              Story
            </label>
            <textarea
              id="story-input"
              className="h-56 w-full rounded border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm"
              value={story}
              onChange={(event) => setStory(event.target.value)}
              maxLength={appLimits.maxStoryChars}
            />

            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{story.trim().length.toLocaleString()} chars</span>
              {loading ? <span>Elapsed: {formatElapsedMs(elapsedMs)}</span> : null}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? "Extracting..." : "Extract Graph"}
              </button>
              <button
                type="button"
                disabled={!loading}
                onClick={cancelCurrentRequest}
                className="rounded border border-zinc-700 px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <GraphControls
              graphMode={graphMode}
              characterEdgeStyle={characterEdgeStyle}
              includeSequenceEdges={includeSequenceEdges}
              usePronounResolver={usePronounResolver}
              showResolverDebug={showResolverDebug}
              allowResolverDebug={allowResolverDebug}
              onGraphModeChange={setGraphMode}
              onCharacterEdgeStyleChange={setCharacterEdgeStyle}
              onIncludeSequenceEdgesChange={setIncludeSequenceEdges}
              onUsePronounResolverChange={setUsePronounResolver}
              onShowResolverDebugChange={setShowResolverDebug}
            />
          </form>

          {allowResolverDebug && showResolverDebug ? (
            <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Preview only</p>
              <p className="mt-1 text-zinc-300">
                This preview does not change the extract request payload.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onGeneratePreview}
                  disabled={resolvingPreview}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs disabled:opacity-50"
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
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-black p-2 text-xs text-zinc-300">
                    {story.trim() || "n/a"}
                  </pre>
                </div>

                <div>
                  <p className="text-xs text-zinc-500">Resolved preview story</p>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-black p-2 text-xs text-zinc-300">
                    {resolvedPreview ?? "Run Generate Preview"}
                  </pre>
                </div>

                <div className="rounded border border-zinc-800 bg-zinc-900 p-2 text-xs">
                  <p>pronounsFound: {resolverPreviewStats?.pronounsFound ?? 0}</p>
                  <p>pronounsResolved: {resolverPreviewStats?.pronounsResolved ?? 0}</p>
                  <p>pronounsSkipped: {resolverPreviewStats?.pronounsSkipped ?? 0}</p>
                  <p>
                    skipReason:{" "}
                    {resolverPreviewStats
                      ? (resolverPreviewStats.skipReason ?? "null")
                      : "n/a"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded border border-red-700 bg-red-950/40 p-3 text-sm">
              <p className="font-medium">Error ({error.code})</p>
              <p className="mt-1 text-zinc-300">{error.message}</p>
              {error.requestId ? <p className="mt-1 text-xs">requestId: {error.requestId}</p> : null}
            </div>
          ) : null}

          <GraphDiagnostics
            requestId={requestId}
            eventsCount={events.length}
            nodesCount={graph.nodes.length}
            edgesCount={graph.edges.length}
            meta={graph.meta}
          />

          {showLargeGraphWarning ? (
            <p className="mt-3 text-sm text-amber-400">
              {graphMode === "timeline"
                ? `Large graph warning: ${events.length} events may impact rendering performance.`
                : `Character graph warning: relation edges are above ${graph.meta?.thresholds.warn ?? appLimits.characterGraphWarnEdges}.`}
            </p>
          ) : null}
          {blockGraphRender ? (
            <p className="mt-2 text-sm text-amber-300">
              {graphMode === "timeline"
                ? `Graph rendering disabled above ${appLimits.largeGraphBlockEvents} events. Reduce input or improve extraction granularity.`
                : `Character graph rendering disabled above ${graph.meta?.thresholds.block ?? appLimits.characterGraphBlockEdges} relation edges.`}
            </p>
          ) : null}

          <details className="mt-4">
            <summary className="cursor-pointer text-sm">Raw events JSON</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-black p-3 text-xs text-zinc-300">
              {JSON.stringify(events, null, 2)}
            </pre>
          </details>
        </section>

        <section className="min-h-[500px] flex-1 rounded-lg border border-zinc-800 bg-zinc-900">
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
              <MiniMap />
              <Controls />
              <Background />
            </ReactFlow>
          )}
        </section>
      </div>
    </main>
  );
}
