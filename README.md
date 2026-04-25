# Narrative Graph Tester (`web-app`)

Standalone Next.js app for testing whether story text can be transformed into a reliable graph of events and entities.

This app intentionally does **not** modify `llm-layer`; it consumes the existing extract endpoint over HTTP.

For architecture details, see [`Architecture.md`](./Architecture.md).

## What It Does

- Accepts raw story input.
- Calls `POST /v1/events/extract` through a server-side proxy (`/api/extract`).
- Validates request and response payloads using local schemas.
- Converts extracted events to graph nodes/edges with deterministic IDs.
- Applies `dagre` layout and renders via React Flow.

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required values:

- `LLM_LAYER_BASE_URL`: Base URL of running `llm-layer` API (example: `http://localhost:4000`)
- `LLM_LAYER_API_KEY`: Optional API key forwarded as `x-api-key` (required if backend enforces API key)
- `REQUEST_TIMEOUT_MS`: Optional proxy timeout override (default: `95000`)

## Timeout Assumptions

- Backend (`llm-layer`) can retry internally; this app assumes worst-case extraction can be long-running.
- Proxy upstream timeout defaults to `95s`.
- Browser-side abort defaults to `100s`.
- Cancellation is propagated from browser -> Next route -> upstream fetch.

## Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Manual Integration Checklist

1. Start `llm-layer` API and confirm readiness endpoint works.
2. Start `web-app` with valid `.env.local`.
3. Paste a sample story and submit.
4. Confirm:
   - response returns `requestId`
   - event count > 0
   - graph renders nodes and edges
5. Toggle **Include sequence edges** and verify additional edges appear.
6. Test cancel flow while loading and confirm request stops with user-visible status.
7. Test large input and verify warning/graph-disable thresholds.

## Known Limits (MVP)

- Entity resolution is normalization-only (`trim -> collapse whitespace -> lowercase`), not full alias/coreference resolution.
- Sequence edges are optional and off by default to reduce visual clutter.
- Graph rendering is capped for very large event volumes.
