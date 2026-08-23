# Flagship Control Plane V2 — Execution Plan

Status: in progress  
Branch: `feat/flagship-sovereign-control-plane-v2`

## Outcome

Deliver a truthful, deterministic Sovereign Decision Control Plane whose live execution,
governance, routing, telemetry, evidence, and audit lineage are inspectable across a
responsive Decision Matrix and deep-linked operational views.

## Sequence

1. **Baseline and traceability** — inspect repository and references; run existing quality
   gates; capture the current UI; document brand bridge, UX brief, requirements, and ADRs.
2. **P0 correctness** — return queued executions before work starts; close SSE replay races;
   make terminal state, routing, telemetry, and execution projections server-authoritative;
   isolate frontend state by execution; document checkpoint durability precisely.
3. **Read model and workflow** — add paginated/filterable projections and the synthetic EU
   critical-infrastructure decision workflow while retaining deterministic routing and HITL.
4. **Flagship experience** — implement the NIL application shell, data-backed Decision Matrix,
   Runs, Run Detail, Governance, Observability, and Architecture Proof routes with accessible
   inspector and guided demo interactions.
5. **Evidence and validation** — add unit/integration/E2E/accessibility/visual checks; capture
   required viewports and states; run an independent screenshot review; reconcile this plan,
   requirements traceability, README, case study, CV evidence, and known limitations.
6. **Delivery** — review the complete diff, run all feasible quality gates, commit reviewable
   changes, and open a pull request without deploying production.

## Engineering constraints

- Fake inference is the default for tests and showcase; no paid model call is permitted.
- The in-process executor is described as single-node and non-durable unless tests prove more.
- Every operational value displayed in the UI comes from a persisted backend projection or the
  versioned deterministic event contract; the browser must not invent metrics.
- Existing framework versions and security boundaries remain unchanged.
- User changes are preserved; no production merge, force-push, or deployment is performed.

## Exit criteria

The Definition of Done is the prompt-level requirements traceability matrix: each mandatory
item must identify implementation, automated or manual evidence, and an honest status. Any
unavailable external credential or environment-limited check remains explicitly unresolved.
