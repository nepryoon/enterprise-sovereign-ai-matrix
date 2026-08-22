# ADR-002: SSE over WebSockets

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Use SSE for the telemetry stream and REST for commands.

## Consequences

Traffic is predominantly server-to-client; native EventSource reconnect semantics reduce complexity. Bidirectional persistent transport is unnecessary.
