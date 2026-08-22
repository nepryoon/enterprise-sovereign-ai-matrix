# ADR-001: Monorepo

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Keep frontend, backend, contracts, deployment and documentation in one repository.

## Consequences

Atomic contract changes and one reproducible Compose release outweigh independent release cadence for this PoC.
