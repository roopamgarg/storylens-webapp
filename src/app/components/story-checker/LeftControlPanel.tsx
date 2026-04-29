"use client";

import type { CharacterEdgeStyle, GraphTransformMeta, GraphViewMode } from "@/lib/graph-transform";
import { appLimits } from "@/lib/constants";
import { DiagnosticsMetaCard } from "./DiagnosticsWidgets";
import { GraphControls } from "./GraphControls";
import type { PreviewStats, UiError } from "./types";

type LeftControlPanelProps = {
  width: number | string;
  isMobile: boolean;
  story: string;
  loading: boolean;
  elapsedLabel: string;
  graphMode: GraphViewMode;
  characterEdgeStyle: CharacterEdgeStyle;
  includeSequenceEdges: boolean;
  usePronounResolver: boolean;
  showResolverDebug: boolean;
  resolvingPreview: boolean;
  resolvedPreview: string | null;
  resolverPreviewStats: PreviewStats | null;
  resolverPreviewMessage: string | null;
  allowResolverDebug: boolean;
  error: UiError | null;
  showLargeGraphWarning: boolean;
  blockGraphRender: boolean;
  eventsCount: number;
  graphEdgesCount: number;
  issuesTotal: number;
  graphMeta?: GraphTransformMeta;
  rawEventsJson: string;
  storySectionCollapsed: boolean;
  graphSettingsSectionCollapsed: boolean;
  advancedSectionCollapsed: boolean;
  rawEventsSectionCollapsed: boolean;
  onToggleStorySection: () => void;
  onToggleGraphSettingsSection: () => void;
  onToggleAdvancedSection: () => void;
  onToggleRawEventsSection: () => void;
  onStoryChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelRequest: () => void;
  onGraphModeChange: (value: GraphViewMode) => void;
  onCharacterEdgeStyleChange: (value: CharacterEdgeStyle) => void;
  onIncludeSequenceEdgesChange: (value: boolean) => void;
  onUsePronounResolverChange: (value: boolean) => void;
  onToggleResolverDebug: (checked: boolean) => void;
  onGeneratePreview: () => void;
};

export function LeftControlPanel(props: LeftControlPanelProps) {
  return (
    <section
      className={`overflow-auto ${props.isMobile ? "pr-0" : "pr-1"}`}
      style={{ width: props.width }}
    >
      <div className="rounded-2xl border border-white/10 bg-[#0d1425]/90 shadow-[0_16px_30px_-20px_rgba(59,130,246,0.5)]">
        <div className="border-b border-white/10 p-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Story Input</h2>
              <p className="text-xs text-zinc-400">Paste your story below. We&apos;ll extract events and build the graph.</p>
            </div>
            <button
              type="button"
              onClick={props.onToggleStorySection}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
              aria-label={`${props.storySectionCollapsed ? "Expand" : "Collapse"} story input section`}
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={`h-4 w-4 transition-transform ${props.storySectionCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {props.storySectionCollapsed ? null : (
            <form className="space-y-3" onSubmit={props.onSubmit}>
              <textarea
                id="story-input"
                className="h-56 w-full rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-sm lg:h-56"
                value={props.story}
                onChange={(event) => props.onStoryChange(event.target.value)}
                maxLength={appLimits.maxStoryChars}
              />
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{props.story.trim().length.toLocaleString()} characters</span>
                {props.loading ? <span>{props.elapsedLabel}</span> : null}
              </div>
              <button
                type="submit"
                disabled={props.loading}
                className="w-full border border-[#d7dce6] bg-[#f5f8ff] px-4 py-2 text-left text-sm font-semibold text-[#0f172a] disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="text-[11px]">▶</span>
                  <span>{props.loading ? "Analyzing..." : "Analyze Story"}</span>
                </span>
              </button>
              {props.loading ? (
                <button
                  type="button"
                  onClick={props.onCancelRequest}
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
              onClick={props.onToggleGraphSettingsSection}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
              aria-label={`${props.graphSettingsSectionCollapsed ? "Expand" : "Collapse"} graph settings section`}
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={`h-4 w-4 transition-transform ${props.graphSettingsSectionCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {props.graphSettingsSectionCollapsed ? null : (
            <GraphControls
              graphMode={props.graphMode}
              characterEdgeStyle={props.characterEdgeStyle}
              includeSequenceEdges={props.includeSequenceEdges}
              usePronounResolver={props.usePronounResolver}
              layout="panel"
              onGraphModeChange={props.onGraphModeChange}
              onCharacterEdgeStyleChange={props.onCharacterEdgeStyleChange}
              onIncludeSequenceEdgesChange={props.onIncludeSequenceEdgesChange}
              onUsePronounResolverChange={props.onUsePronounResolverChange}
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
              onClick={props.onToggleAdvancedSection}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
              aria-label={`${props.advancedSectionCollapsed ? "Expand" : "Collapse"} advanced section`}
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={`h-4 w-4 transition-transform ${props.advancedSectionCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {props.advancedSectionCollapsed ? null : (
            <>
              <DiagnosticsMetaCard
                eventsCount={props.eventsCount}
                edgesCount={props.graphEdgesCount}
                issuesCount={props.issuesTotal}
                runDurationMs={props.graphMeta?.diagnosticsObservability.runDurationMs ?? 0}
              />
              {props.allowResolverDebug ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                  <label className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={props.showResolverDebug}
                      onChange={(event) => props.onToggleResolverDebug(event.target.checked)}
                    />
                    Debug: Pronoun resolver preview
                  </label>

                  {props.showResolverDebug ? (
                    <>
                      <p className="mt-3 text-xs uppercase tracking-wide text-zinc-400">Preview only</p>
                      <p className="mt-1 text-zinc-300">
                        This preview does not change the extract request payload.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={props.onGeneratePreview}
                          disabled={props.resolvingPreview}
                          className="rounded-lg border border-white/15 px-3 py-1 text-xs disabled:opacity-50"
                        >
                          {props.resolvingPreview ? "Generating preview..." : "Generate Preview"}
                        </button>
                        <span className="text-xs text-zinc-500">
                          max {appLimits.pronounPreviewMaxChars.toLocaleString()} chars
                        </span>
                      </div>

                      {props.resolverPreviewMessage ? (
                        <p className="mt-2 text-xs text-amber-300">{props.resolverPreviewMessage}</p>
                      ) : null}

                      <div className="mt-3 grid gap-2">
                        <div>
                          <p className="text-xs text-zinc-500">Original story</p>
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-black p-2 text-xs text-zinc-300">
                            {props.story.trim() || "n/a"}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Resolved preview story</p>
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-black p-2 text-xs text-zinc-300">
                            {props.resolvedPreview ?? "Run Generate Preview"}
                          </pre>
                        </div>
                        <div className="rounded border border-white/10 bg-zinc-900/80 p-2 text-xs">
                          <p>pronounsFound: {props.resolverPreviewStats?.pronounsFound ?? 0}</p>
                          <p>pronounsResolved: {props.resolverPreviewStats?.pronounsResolved ?? 0}</p>
                          <p>pronounsSkipped: {props.resolverPreviewStats?.pronounsSkipped ?? 0}</p>
                          <p>
                            skipReason:{" "}
                            {props.resolverPreviewStats
                              ? (props.resolverPreviewStats.skipReason ?? "null")
                              : "n/a"}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {props.error ? (
                <div className="mt-3 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm">
                  <p className="font-medium text-red-200">Error ({props.error.code})</p>
                  <p className="mt-1 text-zinc-200">{props.error.message}</p>
                  {props.error.requestId ? <p className="mt-1 text-xs">requestId: {props.error.requestId}</p> : null}
                </div>
              ) : null}
              {props.showLargeGraphWarning ? (
                <p className="mt-3 text-sm text-amber-300">
                  {props.graphMode === "timeline"
                    ? `Large graph warning: ${props.eventsCount} events may impact rendering performance.`
                    : `Character graph warning: relation edges are above ${props.graphMeta?.thresholds.warn ?? appLimits.characterGraphWarnEdges}.`}
                </p>
              ) : null}
              {props.blockGraphRender ? (
                <p className="mt-2 text-sm text-amber-200">
                  {props.graphMode === "timeline"
                    ? `Graph rendering disabled above ${appLimits.largeGraphBlockEvents} events. Reduce input or improve extraction granularity.`
                    : `Character graph rendering disabled above ${props.graphMeta?.thresholds.block ?? appLimits.characterGraphBlockEdges} relation edges.`}
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
              onClick={props.onToggleRawEventsSection}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-zinc-200"
              aria-label={`${props.rawEventsSectionCollapsed ? "Expand" : "Collapse"} raw events section`}
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={`h-4 w-4 transition-transform ${props.rawEventsSectionCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {props.rawEventsSectionCollapsed ? null : (
            <pre className="max-h-64 overflow-auto rounded-lg bg-black/60 p-3 text-xs text-zinc-300">
              {props.rawEventsJson}
            </pre>
          )}
        </div>
      </div>
    </section>
  );
}
