# Web App Architecture

## Overview

`web-app` is a standalone Next.js application used to test extraction-to-graph workflows for story narratives.
It does not modify or embed the `llm-layer` codebase. Instead, it integrates with `llm-layer` over HTTP via a server-side proxy route.

Core goals:

- Accept story text from users.
- Submit validated extraction requests to `llm-layer`.
- Transform extracted events into a deterministic graph model.
- Render graph output reliably for interactive testing.

## Components

- `src/app/page.tsx`
  - Client UI for story input, submission, cancel flow, diagnostics, and graph rendering.
  - Includes controls for optional sequence-edge visualization and raw JSON inspection.

- `src/app/api/extract/route.ts`
  - Server-side proxy endpoint (`/api/extract`) to call `POST /v1/events/extract` on `llm-layer`.
  - Applies request validation, upstream response validation, timeout handling, cancellation propagation, concurrency limits, and error mapping.

- `src/lib/contracts.ts`
  - Local schema definitions (Zod) for request/response/error payloads.
  - Prevents trusting unvalidated upstream data and provides typed boundaries for UI and proxy logic.

- `src/lib/graph-transform.ts`
  - Pure deterministic transformation from `events[]` into graph `nodes[]` and `edges[]`.
  - Handles entity normalization and stable ID generation for consistent rendering.

- `src/lib/graph-layout.ts`
  - Dagre-based layout pass that assigns explicit node positions before rendering in React Flow.

- `src/lib/env.ts` and `src/lib/constants.ts`
  - Environment validation and operational limits (timeouts, max story size, large-graph thresholds, concurrent requests).

## Data Flow

1. User enters a story in the UI.
2. UI submits to `web-app` proxy route (`/api/extract`).
3. Proxy validates request and forwards to `llm-layer` extract API.
4. Proxy validates upstream response and returns normalized API payload to UI.
5. UI transforms `events[]` into deterministic graph structures.
6. UI applies dagre layout to graph nodes.
7. React Flow renders nodes/edges with diagnostics.

## Key Decisions

- **Standalone Boundary**
  - `web-app` is independent from `llm-layer` internals.
  - Integration contract is HTTP + schema validation.

- **Server-Side Proxy for Reliability/Security**
  - Keeps `LLM_LAYER_API_KEY` server-side.
  - Avoids browser CORS and centralizes upstream error handling.

- **No Proxy Retries**
  - Proxy performs a single upstream call.
  - Retries are delegated to backend behavior to avoid retry amplification.

- **Deterministic Graph Model**
  - Event node IDs come from backend `eventId`.
  - Entity node IDs use normalized identity (`trim -> collapse whitespace -> lowercase`).
  - Edge IDs are deterministic (`type:source->target`).

- **Performance Guardrails**
  - Large graph warning and render-block thresholds reduce UI degradation for high event counts.
  - Optional sequence edges are disabled by default to limit visual clutter.

- **Timeout and Cancellation**
  - Proxy timeout and browser timeout are coordinated.
  - User cancellation propagates to upstream fetch.

## Operational Constraints

- `LLM_LAYER_BASE_URL` must be valid and reachable by the Next.js server.
- If `llm-layer` enforces authentication, `LLM_LAYER_API_KEY` must be configured.
- This app is currently a testing-focused UI and intentionally avoids production UX complexity.
