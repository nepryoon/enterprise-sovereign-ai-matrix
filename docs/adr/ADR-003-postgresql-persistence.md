# ADR-003: PostgreSQL persistence

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Use PostgreSQL 16 for demo and production persistence.

## Consequences

One durable transactional store supports application executions, audits and ordered telemetry.
Graph checkpoints remain process-local memory pending a supported PostgreSQL saver migration;
SQLite remains limited to development and tests.
