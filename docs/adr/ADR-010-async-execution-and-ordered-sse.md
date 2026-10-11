# ADR-010: Process-local asynchronous execution and ordered SSE

Status: Accepted

## Context

The original create request executed the complete graph before returning an identifier. The
browser could only replay completed telemetry. The history-before-subscribe stream also allowed
an event to be published in the gap.

## Decision

Creation persists and returns a `QUEUED` execution before submitting deterministic work to a
bounded process-local executor. A stable execution-local sequence orders telemetry. Streaming
subscribes before catch-up, emits persisted events in sequence order, and deduplicates the live
queue against the last emitted sequence. Clients use the same sequence contract idempotently.

## Consequences

Showcase transitions are genuinely observable and reconnect is gap-free on a running node. This
is intentionally not a distributed, leased, or restart-safe job queue. A process failure can
leave queued/running work requiring operator recovery. PostgreSQL preserves application events
and audit records, but the current LangGraph checkpoint remains process memory.


## Amendment 2026-10-11: delivery through the web server (T05)

### Context

The browser reaches the API only through the Next.js server (same origin). Its generic
`/api/v1/:path*` rewrite proxied the stream through the server's response compression: with
`Accept-Encoding: gzip, deflate, br`, which every browser sends, the gzip encoder held back an open
stream. A run parked at `WAITING_APPROVAL` delivered 10 bytes in 5 s through
`node .next/standalone/server.js` on Next.js 16.3.8, so the UI stayed at `QUEUED` and never showed
the approval dialog. A stream that closes arrived all at once, which hid the defect for completed
runs. The client only reconciled state on stream events, so nothing recovered it.

### Decision

- `apps/web/app/api/v1/executions/[id]/stream/route.ts` serves the stream. It validates the
  execution ID, fetches `${API_INTERNAL_URL}/api/v1/executions/{id}/stream` at request time with
  `Accept-Encoding: identity` (forwarding `Last-Event-ID`), and returns the upstream body unchanged
  as a stream with `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`,
  `Content-Encoding: identity` and `X-Accel-Buffering: no`. Client disconnect aborts the upstream
  request. Upstream 4xx statuses pass through; an unreachable API returns 502.
- The rewrites moved to the `fallback` phase. Array-form rewrites run before dynamic routes, so the
  `[id]` route handler would otherwise never match. Every other `/api/v1` path is still proxied by
  the rewrite, with its target fixed at build time.
- Response compression stays enabled for HTML and JavaScript. `no-transform` excludes the stream
  from it. The FastAPI stream response also sends `Cache-Control: no-cache, no-transform`, which
  alone was observed to stop the Next.js compressor on the rewrite path, and is the documented
  signal for CDNs.
- The API writes `: connected` as the first byte of every stream and a `: heartbeat` comment after
  10 s without events (was 15 s).
- The browser reads the stream with `fetch` and an incremental SSE parser (`lib/sse.ts`) instead
  of `EventSource`, because `EventSource` hides comments and reports "open" on headers alone. The
  UI reports `connected` only after the first byte. It reconnects with `Last-Event-ID` and
  exponential backoff (1 s to 10 s) until a terminal event, and does not retry 4xx. The reducer
  still deduplicates replayed events by `event_id`.
- Stale-stream fallback (`hooks/use-stale-stream-reconcile.ts`): while the execution is
  non-terminal and no byte, event or comment, has arrived for 5 s, the UI polls
  `GET /executions/{id}` every 3 s and reconciles to the server status. It stops when bytes arrive
  again or the run is terminal. Reconnect attempts do not count as activity.

### Consequences

`scripts/sse-through-web.sh` (Integration CI job `sse-through-web`) starts the fake API and the
standalone server and fails unless `approval.requested` of an open stream arrives within 5 s with
browser `Accept-Encoding`. Before the fix it failed with `Content-Encoding: gzip` and 10 bytes.
After it, 43 events arrive and the first byte comes in under 10 ms. A run waiting for approval
causes about two status polls per 10 s heartbeat interval. Delivery through Cloudflare is not
verified by this change: the public demo needs a redeploy and an edge check (T20).
