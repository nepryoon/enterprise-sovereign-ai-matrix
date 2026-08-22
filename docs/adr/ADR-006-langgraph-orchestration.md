# ADR-006: LangGraph orchestration

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Use a typed fixed LangGraph with native interrupt/resume.

## Consequences

It makes transitions testable and HITL durable while preventing an LLM from inventing topology.
