"use client";

import type { Event, GraphDiagnostic } from "@/lib/contracts";
import type { GraphTransformMeta } from "@/lib/graph-transform";
import { GraphDiagnostics } from "./DiagnosticsWidgets";

type RightDiagnosticsPanelProps = {
  collapsed: boolean;
  railWidth: number;
  width: number | string;
  isMobile: boolean;
  hasCompletedAnalysis: boolean;
  requestId?: string;
  events: Event[];
  graphNodesCount: number;
  graphEdgesCount: number;
  meta?: GraphTransformMeta;
  severityFilter: "all" | "error" | "warning";
  categoryFilter: "all" | GraphDiagnostic["category"];
  eventIdToIndex: Map<string, number>;
  onExpand: () => void;
  onSeverityFilterChange: (value: "all" | "error" | "warning") => void;
  onCategoryFilterChange: (value: "all" | GraphDiagnostic["category"]) => void;
};

export function RightDiagnosticsPanel(props: RightDiagnosticsPanelProps) {
  if (props.collapsed && !props.isMobile) {
    return (
      <div
        className="hidden h-full items-center justify-center rounded-2xl border border-white/10 bg-[#0d1425]/90 lg:flex"
        style={{ width: props.railWidth }}
      >
        <button
          type="button"
          onClick={props.onExpand}
          disabled={!props.hasCompletedAnalysis}
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
    );
  }

  return (
    <aside
      className="space-y-3 overflow-auto rounded-2xl border border-white/10 bg-[#0d1425]/90 p-3"
      style={{ width: props.width }}
    >
      <div>
        <h2 className="text-lg font-semibold">Diagnostics</h2>
        <p className="text-xs text-zinc-400">Issues and quality insights about your story</p>
      </div>
      <GraphDiagnostics
        requestId={props.requestId}
        eventsCount={props.events.length}
        nodesCount={props.graphNodesCount}
        edgesCount={props.graphEdgesCount}
        meta={props.meta}
        severityFilter={props.severityFilter}
        categoryFilter={props.categoryFilter}
        eventIdToIndex={props.eventIdToIndex}
        onSeverityFilterChange={props.onSeverityFilterChange}
        onCategoryFilterChange={props.onCategoryFilterChange}
      />
    </aside>
  );
}
