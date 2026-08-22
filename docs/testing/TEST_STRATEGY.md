# Test strategy

The test pyramid uses deterministic fake inference by default. Backend unit tests cover state transitions, every material node, routing/fail-closed policy, cost, redaction and event schemas. Integration tests cover FastAPI → graph → persistence/SSE and native interrupt → approve/reject → resume. Frontend component tests mock EventSource and REST for status, reconnect, approval and errors. The demo smoke script exercises the high-risk vertical slice.

`RUN_LIVE_LLM_TESTS=false` is the invariant for CI. Live tests require an explicit marker and environment opt-in. Core Python domain coverage targets at least 80%; coverage exclusions must not conceal domain logic.
