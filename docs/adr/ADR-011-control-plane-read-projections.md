# ADR-011: Server-authoritative control-plane projections

Status: Accepted

## Context

Deriving route, cost, status, and agent state from browser inputs made historical views mutable
and allowed telemetry from one execution to contaminate another.

## Decision

The API exposes paginated execution summaries plus event-derived agent, route, approval, audit,
metric, topology, and build projections. The web client keys state by execution ID and treats the
execution resource as authoritative after approval, terminal events, and reconnect.

## Consequences

Operational views share one persisted source of truth. The initial reference implementation may
compute projections from the append-only event store; schema-backed materialisation is reserved
for measured scale requirements and must use a migration/backfill rather than `create_all` alone.

