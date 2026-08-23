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

