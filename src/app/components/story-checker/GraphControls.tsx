"use client";

import type { CharacterEdgeStyle, GraphViewMode } from "@/lib/graph-transform";

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

export function GraphControls(props: GraphControlsProps) {
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
