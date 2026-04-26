import type { Event, GraphDiagnostic } from "@/lib/contracts";
import { type DiagnosticSeverity } from "@/lib/contracts";
import { toEntityNodeId } from "@/lib/graph-transform/shared";

type DiagnosticContext = {
  events: Event[];
  includeSequenceEdges: boolean;
};

export type StoryDiagnosticsRun = {
  diagnostics: GraphDiagnostic[];
  perRuleHitCount: Record<string, number>;
  degradedModeCount: number;
  runDurationMs: number;
};

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function buildDiagnosticId(
  category: GraphDiagnostic["category"],
  subtype: GraphDiagnostic["subtype"],
  refs: string[],
): string {
  const normalizedRefs = refs.filter(Boolean).sort().join("|");
  return `${category}:${subtype}:${stableHash(normalizedRefs)}`;
}

function parseTimeMs(timeHint: string | undefined): number | null {
  if (!timeHint) {
    return null;
  }
  const parsed = Date.parse(timeHint);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEventActorEntityIds(event: Event): string[] {
  return event.actors.map((actor) => toEntityNodeId(actor));
}

function getEventTargetEntityIds(event: Event): string[] {
  return (event.targets ?? []).map((target) => toEntityNodeId(target));
}

function pushDiagnostic(
  target: GraphDiagnostic[],
  input: Omit<GraphDiagnostic, "id">,
  idRefs: string[],
): void {
  target.push({
    ...input,
    id: buildDiagnosticId(input.category, input.subtype, idRefs),
  });
}

function countByRule(diagnostics: GraphDiagnostic[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const diagnostic of diagnostics) {
    const ruleKey = `${diagnostic.category}.${diagnostic.subtype}`;
    counts[ruleKey] = (counts[ruleKey] ?? 0) + 1;
  }
  return counts;
}

function computeTimelineDiagnostics(ctx: DiagnosticContext, output: GraphDiagnostic[]): void {
  const eventByActor = new Map<string, Event[]>();
  for (const event of ctx.events) {
    for (const actorEntityId of getEventActorEntityIds(event)) {
      const list = eventByActor.get(actorEntityId) ?? [];
      list.push(event);
      eventByActor.set(actorEntityId, list);
    }
  }

  if (!ctx.includeSequenceEdges && ctx.events.length > 1) {
    pushDiagnostic(
      output,
      {
        category: "timeline",
        subtype: "missing_temporal_edge",
        severity: "warning",
        message: "Sequence edges are disabled; explicit temporal transitions are missing in graph view.",
        confidence: 1,
        nodeIds: ctx.events.map((event) => event.eventId),
        evidence: {
          eventIds: ctx.events.map((event) => event.eventId),
        },
      },
      ctx.events.map((event) => event.eventId),
    );
  }

  for (const [actorEntityId, actorEvents] of eventByActor.entries()) {
    for (let index = 0; index < actorEvents.length - 1; index += 1) {
      const current = actorEvents[index];
      const next = actorEvents[index + 1];
      const currentTime = parseTimeMs(current.timeHint);
      const nextTime = parseTimeMs(next.timeHint);
      if (
        currentTime !== null &&
        nextTime !== null &&
        nextTime < currentTime &&
        current.confidence >= 0.7 &&
        next.confidence >= 0.7
      ) {
        pushDiagnostic(
          output,
          {
            category: "timeline",
            subtype: "event_order_violation",
            severity: "error",
            message: `Event order inconsistency: ${next.eventId} is earlier than ${current.eventId} for the same entity.`,
            confidence: Math.min(current.confidence, next.confidence),
            nodeIds: [current.eventId, next.eventId, actorEntityId],
            evidence: {
              eventIds: [current.eventId, next.eventId],
              entityIds: [actorEntityId],
            },
          },
          [current.eventId, next.eventId, actorEntityId, "order"],
        );
      }
    }

    const sorted = [...actorEvents].sort((left, right) => {
      const leftTime = parseTimeMs(left.timeHint);
      const rightTime = parseTimeMs(right.timeHint);
      if (leftTime !== null && rightTime !== null) {
        return leftTime - rightTime;
      }
      return 0;
    });

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      const currentTime = parseTimeMs(current.timeHint);
      const nextTime = parseTimeMs(next.timeHint);
      const currentLocation = current.location?.trim().toLowerCase();
      const nextLocation = next.location?.trim().toLowerCase();

      if (
        currentTime !== null &&
        nextTime !== null &&
        currentTime === nextTime &&
        currentLocation &&
        nextLocation &&
        currentLocation !== nextLocation
      ) {
        const severity: DiagnosticSeverity =
          current.confidence >= 0.75 && next.confidence >= 0.75 ? "error" : "warning";
        pushDiagnostic(
          output,
          {
            category: "timeline",
            subtype: "simultaneity_conflict",
            severity,
            message: `Entity appears in multiple locations at the same time (${current.location} vs ${next.location}).`,
            confidence: Math.min(current.confidence, next.confidence),
            nodeIds: [current.eventId, next.eventId, actorEntityId],
            evidence: {
              eventIds: [current.eventId, next.eventId],
              entityIds: [actorEntityId],
            },
          },
          [current.eventId, next.eventId, actorEntityId],
        );
      }

      if (
        currentTime !== null &&
        nextTime !== null &&
        nextTime > currentTime &&
        currentLocation &&
        nextLocation &&
        currentLocation !== nextLocation &&
        current.action !== "MOVE"
      ) {
        pushDiagnostic(
          output,
          {
            category: "spatial",
            subtype: "location_transition_missing",
            severity: "warning",
            message: `Location changes from ${current.location} to ${next.location} without an explicit MOVE transition.`,
            confidence: Math.min(current.confidence, next.confidence),
            nodeIds: [current.eventId, next.eventId, actorEntityId],
            evidence: {
              eventIds: [current.eventId, next.eventId],
              entityIds: [actorEntityId],
            },
          },
          [current.eventId, next.eventId, actorEntityId, "transition"],
        );
      }

      if (
        currentTime !== null &&
        nextTime !== null &&
        nextTime > currentTime &&
        currentLocation &&
        nextLocation &&
        currentLocation !== nextLocation &&
        nextTime - currentTime < 60_000
      ) {
        const severity: DiagnosticSeverity =
          current.confidence >= 0.8 && next.confidence >= 0.8 ? "error" : "warning";
        pushDiagnostic(
          output,
          {
            category: "spatial",
            subtype: "travel_time_violation",
            severity,
            message: `Unrealistic travel duration (${Math.round((nextTime - currentTime) / 1000)}s) between ${current.location} and ${next.location}.`,
            confidence: Math.min(current.confidence, next.confidence),
            nodeIds: [current.eventId, next.eventId, actorEntityId],
            evidence: {
              eventIds: [current.eventId, next.eventId],
              entityIds: [actorEntityId],
            },
          },
          [current.eventId, next.eventId, actorEntityId, "travel"],
        );
      }
    }
  }
}

function computeCausalityAndGapDiagnostics(ctx: DiagnosticContext, output: GraphDiagnostic[]): void {
  const events = ctx.events;
  const adjacency = new Map<string, Set<string>>();
  for (const event of events) {
    adjacency.set(event.eventId, new Set<string>());
  }

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
      const left = events[leftIndex];
      const right = events[rightIndex];
      const leftEntities = new Set([...getEventActorEntityIds(left), ...getEventTargetEntityIds(left)]);
      const rightEntities = [...getEventActorEntityIds(right), ...getEventTargetEntityIds(right)];
      const intersects = rightEntities.some((entity) => leftEntities.has(entity));
      if (intersects) {
        adjacency.get(left.eventId)?.add(right.eventId);
        adjacency.get(right.eventId)?.add(left.eventId);
      }
    }
  }

  const visited = new Set<string>();
  let componentCount = 0;
  for (const event of events) {
    if (visited.has(event.eventId)) {
      continue;
    }
    componentCount += 1;
    const stack = [event.eventId];
    while (stack.length > 0) {
      const id = stack.pop();
      if (!id || visited.has(id)) {
        continue;
      }
      visited.add(id);
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
  }

  if (componentCount > 1 && events.length > 1) {
    pushDiagnostic(
      output,
      {
        category: "missing_links",
        subtype: "missing_interaction",
        severity: "warning",
        message: `Narrative has ${componentCount} disconnected event components with no bridge interaction.`,
        confidence: 0.85,
        nodeIds: events.map((event) => event.eventId),
        evidence: {
          eventIds: events.map((event) => event.eventId),
          notes: ["weakly_connected_components"],
        },
      },
      [...events.map((event) => event.eventId), `components:${componentCount}`],
    );
  }

  const actionToEventIds = new Map<string, string[]>();
  for (const event of events) {
    const ids = actionToEventIds.get(event.action) ?? [];
    ids.push(event.eventId);
    actionToEventIds.set(event.action, ids);
  }
  for (const [action, eventIds] of actionToEventIds.entries()) {
    if (eventIds.length >= 3) {
      pushDiagnostic(
        output,
        {
          category: "redundancy",
          subtype: "narrative_loop",
          severity: "warning",
          message: `Detected potential non-progress loop: action ${action} repeats ${eventIds.length} times.`,
          confidence: 0.75,
          nodeIds: eventIds,
          evidence: {
            eventIds,
            notes: ["repeated_action_cycle_heuristic"],
          },
        },
        [...eventIds, action, "loop"],
      );
    }
  }

  const dependentActions = new Set(["DEFEND", "ATTACK", "ITEM_CHANGE", "STATE_CHANGE", "EMOTIONAL_CHANGE"]);
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!dependentActions.has(event.action)) {
      continue;
    }
    const prior = events.slice(0, index);
    const currentEntities = new Set([...getEventActorEntityIds(event), ...getEventTargetEntityIds(event)]);
    const hasCause = prior.some((candidate) => {
      const candidateEntities = [...getEventActorEntityIds(candidate), ...getEventTargetEntityIds(candidate)];
      return candidateEntities.some((entity) => currentEntities.has(entity));
    });
    if (!hasCause) {
      pushDiagnostic(
        output,
        {
          category: "causality",
          subtype: "missing_cause",
          severity: "warning",
          message: `Event ${event.eventId} appears without an earlier causal trigger for involved entities.`,
          confidence: event.confidence,
          nodeIds: [event.eventId],
          evidence: {
            eventIds: [event.eventId],
          },
        },
        [event.eventId, "missing-cause"],
      );
    }

    if (index > 0 && index < events.length - 1) {
      const previous = events[index - 1];
      const next = events[index + 1];
      const prevEntities = new Set([...getEventActorEntityIds(previous), ...getEventTargetEntityIds(previous)]);
      const nextEntities = [...getEventActorEntityIds(next), ...getEventTargetEntityIds(next)];
      const bridgesNext = nextEntities.some((entityId) => prevEntities.has(entityId));
      if (!bridgesNext) {
        pushDiagnostic(
          output,
          {
            category: "causality",
            subtype: "broken_chain",
            severity: "warning",
            message: `Possible broken causal chain around event ${event.eventId}; neighboring events are weakly linked.`,
            confidence: Math.min(previous.confidence, event.confidence, next.confidence),
            nodeIds: [previous.eventId, event.eventId, next.eventId],
            evidence: {
              eventIds: [previous.eventId, event.eventId, next.eventId],
            },
          },
          [previous.eventId, event.eventId, next.eventId, "chain"],
        );
      }
    }
  }

  for (let index = 0; index < events.length - 1; index += 1) {
    const left = events[index];
    const right = events[index + 1];
    const leftTargets = new Set(getEventTargetEntityIds(left));
    const rightActors = getEventActorEntityIds(right);
    const rightTargets = new Set(getEventTargetEntityIds(right));
    const leftActors = getEventActorEntityIds(left);
    const forwardShared = rightActors.some((entityId) => leftTargets.has(entityId));
    const reverseShared = leftActors.some((entityId) => rightTargets.has(entityId));
    if (forwardShared && reverseShared) {
      pushDiagnostic(
        output,
        {
          category: "causality",
          subtype: "circular_causality",
          severity: "warning",
          message: `Potential circular causality between consecutive events ${left.eventId} and ${right.eventId}.`,
          confidence: Math.min(left.confidence, right.confidence),
          nodeIds: [left.eventId, right.eventId],
          evidence: {
            eventIds: [left.eventId, right.eventId],
          },
        },
        [left.eventId, right.eventId, "circular"],
      );
    }
  }
}

function computeRedundancyAndDependencyDiagnostics(ctx: DiagnosticContext, output: GraphDiagnostic[]): void {
  const events = ctx.events;
  const signatureToEvents = new Map<string, Event[]>();
  const acquiredItemsByActor = new Map<string, Set<string>>();

  for (const event of events) {
    const signature = [
      event.action,
      [...event.actors].sort().join(","),
      [...(event.targets ?? [])].sort().join(","),
      (event.location ?? "").trim().toLowerCase(),
      (event.timeHint ?? "").trim().toLowerCase(),
      event.sourceText.trim().toLowerCase(),
    ].join("|");
    const signatureEvents = signatureToEvents.get(signature) ?? [];
    signatureEvents.push(event);
    signatureToEvents.set(signature, signatureEvents);

    const itemTargets = (event.targets ?? []).map((target) => target.trim().toLowerCase()).filter(Boolean);
    for (const actor of event.actors.map((value) => value.trim().toLowerCase()).filter(Boolean)) {
      const acquiredItems = acquiredItemsByActor.get(actor) ?? new Set<string>();
      if (event.action === "DISCOVER" || event.action === "ITEM_CHANGE") {
        for (const item of itemTargets) {
          acquiredItems.add(item);
        }
      }

      const source = event.sourceText.toLowerCase();
      const resemblesUsage = source.includes("use ") || source.includes("uses ") || source.includes("used ");
      if (resemblesUsage) {
        for (const item of itemTargets) {
          if (!acquiredItems.has(item)) {
            pushDiagnostic(
              output,
              {
                category: "dependency",
                subtype: "dependency_reversed",
                severity: "warning",
                message: `${actor} appears to use ${item} before it is established in the narrative.`,
                confidence: event.confidence,
                nodeIds: [event.eventId, toEntityNodeId(actor), toEntityNodeId(item)],
                evidence: {
                  eventIds: [event.eventId],
                  entityIds: [toEntityNodeId(actor), toEntityNodeId(item)],
                },
              },
              [event.eventId, actor, item, "dependency"],
            );
          }
        }
      }

      acquiredItemsByActor.set(actor, acquiredItems);
    }
  }

  for (const groupedEvents of signatureToEvents.values()) {
    if (groupedEvents.length < 2) {
      continue;
    }
    pushDiagnostic(
      output,
      {
        category: "redundancy",
        subtype: "duplicate_event",
        severity: "warning",
        message: `Detected ${groupedEvents.length} duplicated events with identical narrative signature.`,
        confidence: Math.min(...groupedEvents.map((event) => event.confidence)),
        nodeIds: groupedEvents.map((event) => event.eventId),
        evidence: {
          eventIds: groupedEvents.map((event) => event.eventId),
        },
      },
      groupedEvents.map((event) => event.eventId),
    );
  }
}

function dedupeDiagnostics(diagnostics: GraphDiagnostic[]): GraphDiagnostic[] {
  const byId = new Map<string, GraphDiagnostic>();
  for (const diagnostic of diagnostics) {
    const existing = byId.get(diagnostic.id);
    if (!existing) {
      byId.set(diagnostic.id, diagnostic);
      continue;
    }

    const severityRank = (value: DiagnosticSeverity) => (value === "error" ? 2 : 1);
    if (severityRank(diagnostic.severity) > severityRank(existing.severity)) {
      byId.set(diagnostic.id, diagnostic);
    }
  }
  return Array.from(byId.values());
}

function computeAbruptTransitions(events: Event[], output: GraphDiagnostic[]): number {
  let degradedModeCount = 0;
  for (let index = 0; index < events.length - 1; index += 1) {
    const current = events[index];
    const next = events[index + 1];
    const currentActors = new Set(getEventActorEntityIds(current));
    const nextActors = getEventActorEntityIds(next);
    const sharedActor = nextActors.find((entityId) => currentActors.has(entityId));
    if (!sharedActor) {
      continue;
    }
    const locationChanged =
      Boolean(current.location?.trim()) &&
      Boolean(next.location?.trim()) &&
      current.location?.trim().toLowerCase() !== next.location?.trim().toLowerCase();
    const actionChanged = current.action !== next.action;
    if (locationChanged && actionChanged) {
      const severity: DiagnosticSeverity =
        current.confidence >= 0.8 && next.confidence >= 0.8 ? "error" : "warning";
      if (severity === "warning") {
        degradedModeCount += 1;
      }
      pushDiagnostic(
        output,
        {
          category: "missing_links",
          subtype: "abrupt_transition",
          severity,
          message: `Abrupt transition detected for shared entity without explicit bridge event.`,
          confidence: Math.min(current.confidence, next.confidence),
          nodeIds: [current.eventId, next.eventId, sharedActor],
          evidence: {
            eventIds: [current.eventId, next.eventId],
            entityIds: [sharedActor],
          },
        },
        [current.eventId, next.eventId, sharedActor, "abrupt"],
      );
    }
  }
  return degradedModeCount;
}

export function detectStoryDiagnostics(context: DiagnosticContext): StoryDiagnosticsRun {
  const startedAt = Date.now();
  const diagnostics: GraphDiagnostic[] = [];
  if (context.events.length === 0) {
    return {
      diagnostics,
      perRuleHitCount: {},
      degradedModeCount: 0,
      runDurationMs: Date.now() - startedAt,
    };
  }

  computeTimelineDiagnostics(context, diagnostics);
  computeCausalityAndGapDiagnostics(context, diagnostics);
  computeRedundancyAndDependencyDiagnostics(context, diagnostics);
  const degradedModeCount = computeAbruptTransitions(context.events, diagnostics);

  const deduped = dedupeDiagnostics(diagnostics);
  return {
    diagnostics: deduped,
    perRuleHitCount: countByRule(deduped),
    degradedModeCount,
    runDurationMs: Date.now() - startedAt,
  };
}

export function summarizeDiagnostics(diagnostics: GraphDiagnostic[]): {
  total: number;
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") {
      errors += 1;
    } else {
      warnings += 1;
    }
  }
  return {
    total: diagnostics.length,
    errors,
    warnings,
  };
}
