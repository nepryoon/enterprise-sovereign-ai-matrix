# ADR-004: LiteLLM gateway

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Route model-class aliases through LiteLLM.

## Consequences

Domain code remains provider-neutral and provider names/credentials stay in configuration.
