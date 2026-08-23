# Flagship UX brief

## Five-second comprehension target

The first viewport answers: what decision is active, which agents are working, their phase,
the selected model and placement, whether residency held, whether approval is required, and
where evidence/cost/latency/audit lineage can be inspected.

## Operational composition

- Persistent top bar: NIL identity, synthetic-data/environment disclosure, residency, stream
  state, active ID, cost, guided demo, and portfolio link.
- Compact navigation rail with only implemented deep links.
- Context pane for scenario catalogue, recent executions, filters, and demo narrative.
- Central CSS-grid Decision Matrix: phases are columns; disciplines are rows; cells contain
  persisted tasks/events rather than browser-generated activity.
- Contextual inspector for status, evidence, dependencies, authoritative route, policy, trace,
  cost, tokens, latency, and real approval actions.
- Dense secondary routes for runs, governance, observability/audit, and architecture proof.

## Interaction and responsive rules

Cards are selectable by click and keyboard, have visible focus, and never reserve essential
information for hover. Text/icon/colour jointly communicate status. At narrow widths navigation
compacts, the matrix becomes a phase-grouped list, and the inspector becomes a sheet. The document
must not overflow horizontally; the explicitly labelled matrix workspace may scroll internally.
Touch targets are at least 44px and motion respects `prefers-reduced-motion`.

## Reference boundary

The requested attachment was unavailable in the conversation and not found in the workspace, so
the prompt specification is the authoritative conceptual reference. No external product branding,
composition, wording, background, trademark, or proprietary asset is reproduced.

