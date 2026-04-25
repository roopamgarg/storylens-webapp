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
  type GraphEdgeData,
  type GraphNodeData,
} from "@/lib/graph-transform";

type UiError = {
  code: ErrorCode | "NETWORK_ERROR";
  message: string;
  requestId?: string;
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

export default function Home() {
  const [story, setStory] = useState(sampleStory);
  const [events, setEvents] = useState<Event[]>([]);
  const [requestId, setRequestId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [includeSequenceEdges, setIncludeSequenceEdges] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeStoryFingerprint, setActiveStoryFingerprint] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const graph = useMemo(() => {
    const transformed = transformEventsToGraph(events, { includeSequenceEdges });
    const laidOutNodes = applyDagreLayout(transformed.nodes, transformed.edges);
    return {
      nodes: laidOutNodes,
      edges: transformed.edges,
    };
  }, [events, includeSequenceEdges]);

  const showLargeGraphWarning = events.length > appLimits.largeGraphWarnEvents;
  const blockGraphRender = events.length > appLimits.largeGraphBlockEvents;
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
        body: JSON.stringify({ story: normalizedStory }),
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeSequenceEdges}
                onChange={(event) => setIncludeSequenceEdges(event.target.checked)}
              />
              Include sequence edges
            </label>
          </form>

          {error ? (
            <div className="mt-4 rounded border border-red-700 bg-red-950/40 p-3 text-sm">
              <p className="font-medium">Error ({error.code})</p>
              <p className="mt-1 text-zinc-300">{error.message}</p>
              {error.requestId ? <p className="mt-1 text-xs">requestId: {error.requestId}</p> : null}
            </div>
          ) : null}

          <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
            <p>
              requestId: <span className="text-zinc-300">{requestId ?? "n/a"}</span>
            </p>
            <p>
              events: <span className="text-zinc-300">{events.length}</span>
            </p>
            <p>
              nodes: <span className="text-zinc-300">{graph.nodes.length}</span>
            </p>
            <p>
              edges: <span className="text-zinc-300">{graph.edges.length}</span>
            </p>
          </div>

          {showLargeGraphWarning ? (
            <p className="mt-3 text-sm text-amber-400">
              Large graph warning: {events.length} events may impact rendering performance.
            </p>
          ) : null}
          {blockGraphRender ? (
            <p className="mt-2 text-sm text-amber-300">
              Graph rendering disabled above {appLimits.largeGraphBlockEvents} events. Reduce input
              or improve extraction granularity.
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
