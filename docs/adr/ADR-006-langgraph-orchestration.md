# ADR-006: LangGraph orchestration

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Use a typed fixed LangGraph with native interrupt/resume.

## Consequences

It makes transitions and native HITL pause/resume testable while preventing an LLM from inventing
topology. The current `InMemorySaver` is not restart durable; deterministic fake replay is a
bounded recovery mechanism, not checkpoint persistence.
