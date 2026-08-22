# ADR-008: Compact sovereign model

- Status: Accepted
- Date: 2026-08-22

## Context

The build contract requires a low-cost, deterministic, secure showcase deployment.

## Decision

Use `qwen2.5:1.5b-instruct-q4_K_M` through Ollama.

## Consequences

The quantised 1.5B model needs roughly 1.5–2.5 GB RAM and demonstrates residency on CPU hardware. It is not suitable for final high-stakes judgement and CPU latency can be high.
