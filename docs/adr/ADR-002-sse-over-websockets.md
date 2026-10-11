# ADR-002: SSE over WebSockets

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Use SSE for the telemetry stream and REST for commands.

## Consequences

Traffic is predominantly server-to-client; native EventSource reconnect semantics reduce complexity. Bidirectional persistent transport is unnecessary.

Amendment 2026-10-11 (T05): the browser now reads the stream with `fetch` and an SSE parser instead
of `EventSource`, keeping SSE on the wire, so heartbeats count as liveness and "connected" means
bytes arrived. Reconnect with `Last-Event-ID` is implemented in the client. See ADR-010.
