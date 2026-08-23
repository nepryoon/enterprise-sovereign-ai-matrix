# Repository working agreement

## Architecture

- `apps/api` is the FastAPI/LangGraph control plane. Keep transitions typed, routing fail-closed,
  events/audits append-only, fake inference deterministic, and every UI metric server-authoritative.
- `apps/web` is the Next.js App Router client. Keep API access same-origin, state isolated by
  execution ID, SSE reducers idempotent, and all operational routes deep-linkable.
- The process-local executor and LangGraph memory checkpointer are not distributed or
  restart-durable. Do not claim otherwise without a supported migration and recovery test.

## Build and test

Run from the repository root:

- `make lint`
- `make typecheck`
- `make test`
- `make test-integration`
- `make build`
- `make compose-config`
- `make security`
- `make smoke` against a locally running stack

Use `npm ci` in CI and containers. Tests and showcase mode must not call paid models.

## Definition of Done

- Preserve approve/reject audit semantics and sovereign fail-closed routing.
- Prove SSE ordering/reconnect deduplication and respect server-authoritative terminal status.
- Add tests for each correctness change; do not weaken a failing valid test.
- Meet keyboard, reduced-motion, responsive, and non-colour-only status requirements.
- Update `docs/design/REQUIREMENTS_TRACEABILITY.md` and truthful limitations for material work.
- Never commit secrets, deploy production, or describe unimplemented multi-tenancy, distributed
  execution, regulatory compliance, Kubernetes, or Terraform.

