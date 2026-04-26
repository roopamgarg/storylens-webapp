"use client";

import type { GraphDiagnostic } from "@/lib/contracts";
import type { GraphTransformMeta } from "@/lib/graph-transform";

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

export function GraphDiagnostics(props: GraphDiagnosticsProps) {
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

type DiagnosticsMetaCardProps = {
  eventsCount: number;
  edgesCount: number;
  issuesCount: number;
  runDurationMs: number;
};

export function DiagnosticsMetaCard(props: DiagnosticsMetaCardProps) {
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
