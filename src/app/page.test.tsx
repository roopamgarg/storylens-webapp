import { describe, expect, it } from "vitest";

import { resolveGraphRenderState } from "@/app/page";
import type { GraphTransformMeta } from "@/lib/graph-transform";

describe("resolveGraphRenderState", () => {
  it("uses event-count thresholds in timeline mode", () => {
    const warningState = resolveGraphRenderState("timeline", 81, undefined);
    expect(warningState.showLargeGraphWarning).toBe(true);
    expect(warningState.blockGraphRender).toBe(false);

    const blockState = resolveGraphRenderState("timeline", 151, undefined);
    expect(blockState.blockGraphRender).toBe(true);
  });

  it("uses densityStatus in character mode", () => {
    const baseMeta: GraphTransformMeta = {
      mode: "character",
      characterEdgeStyle: "cooccurrence",
      relationEdgeCount: 10,
      fallbackOrderCount: 0,
      densityStatus: "warn",
      thresholds: { warn: 5, block: 15 },
      droppedEventCount: 0,
    };

    const warningState = resolveGraphRenderState("character", 999, baseMeta);
    expect(warningState.showLargeGraphWarning).toBe(true);
    expect(warningState.blockGraphRender).toBe(false);

    const blockedState = resolveGraphRenderState("character", 1, {
      ...baseMeta,
      densityStatus: "blocked",
    });
    expect(blockedState.blockGraphRender).toBe(true);
  });
});
