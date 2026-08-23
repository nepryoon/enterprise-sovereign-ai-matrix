# CV evidence ledger

## Supported statement

> Built a deterministic sovereign AI orchestration reference workflow with fail-closed routing,
> native human approval/rejection, ordered replayable telemetry, cost/token/latency lineage, and
> a responsive Next.js operational Decision Matrix backed by a FastAPI control plane.

## Repository evidence

- Graph topology and interrupt: `apps/api/app/graph/workflow.py`
- Routing policy and provider boundary: `apps/api/app/routing/policy.py`
- Execution, telemetry and audit API: `apps/api/app/api/routes.py`
- Persistence: `apps/api/app/persistence/database.py`
- Operational UI and deep links: `apps/web/app` and `apps/web/components`
- Automated verification: `apps/api/tests`, `apps/web/tests`, and browser tests when present

## Claims intentionally excluded

No claim is made for Kubernetes, Terraform, multi-tenancy, distributed execution, regulatory
certification/compliance, production-scale load, or restart-durable arbitrary model checkpoints.
