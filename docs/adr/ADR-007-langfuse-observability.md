# ADR-007: Langfuse observability

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Export redacted traces to self-hosted Langfuse on a best-effort boundary.

## Consequences

Trace correlation improves operations; exporter failure must never corrupt business execution. Compose uses the validated Langfuse v4 web/worker contract with PostgreSQL, ClickHouse 26.4, Redis and S3-compatible object storage. The application adapter isolates future server/API migrations.
