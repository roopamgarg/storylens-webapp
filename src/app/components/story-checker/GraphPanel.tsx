"use client";

import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import type { GraphEdgeData, GraphNodeData, GraphViewMode } from "@/lib/graph-transform";

type GraphPanelProps = {
  graphMode: GraphViewMode;
  blockGraphRender: boolean;
  nodesToRender: Node<GraphNodeData>[];
  edgesToRender: Edge<GraphEdgeData>[];
  isMobile: boolean;
};

export function GraphPanel(props: GraphPanelProps) {
  return (
    <section className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0d1425]/90 p-2.5 lg:flex lg:h-full lg:flex-col lg:overflow-hidden">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-semibold">Event Graph</h2>
          <p className="text-xs text-zinc-400">Timeline view of events. Red indicates inconsistencies.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
            {props.graphMode === "timeline" ? "Timeline" : "Character"}
          </div>
        </div>
      </div>
      <div
        className={`rounded-xl border border-white/10 bg-black/25 ${
          props.isMobile ? "h-[58vh] min-h-[360px]" : "h-[500px] lg:h-[calc(100%-42px)]"
        }`}
      >
        {props.blockGraphRender ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            Graph hidden due to event volume.
          </div>
        ) : (
          <ReactFlow
            fitView
            onlyRenderVisibleElements
            nodes={props.nodesToRender}
            edges={props.edgesToRender}
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
  );
}
