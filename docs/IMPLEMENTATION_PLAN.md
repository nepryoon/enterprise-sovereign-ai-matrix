# Implementation plan

The prioritised backlog follows the release gates in `BUILD_SPEC.md`. Work is accepted only with deterministic tests and documentation.

| Priority | Deliverable | Acceptance gate |
|---|---|---|
| P0 | Typed domain, LangGraph workflow, checkpoint and HITL | graph transition/resume tests pass |
| P0 | Central routing and inference adapters | routing and fail-closed tests pass without paid calls |
| P0 | Persistence, REST, SSE and audit | API-to-graph integration tests pass |
| P0 | Mission Control, matrix and approval UI | lint, type check, component tests and build pass |
| P1 | Langfuse adapter and redaction | adapter tests; outage does not fail execution |
| P1 | Compose, CI, Cloudflare deployment | Compose configuration and container smoke pass |
| P1 | Security, operational and FinOps review | release checklist and validation report complete |

Live-provider validation is optional, explicitly selected with `RUN_LIVE_LLM_TESTS=true`, and never runs in ordinary CI.
