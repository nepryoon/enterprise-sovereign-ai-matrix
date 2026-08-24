# Flagship Control Plane V2 — requirements traceability

Evidence date: 2026-08-24. `Implemented` means repository evidence exists; `Verified` additionally
means the named check ran successfully in this environment. Blocked items are not represented as
complete.

The production workflow propagates the privileged deployment process exit status from the
self-hosted runner, then uses a GitHub-hosted job to retry the public application smoke test during
the rollout. The production runner must remain online for the deploy command; runner recovery is an
operator responsibility and is not represented as application-level deployment resilience.

| Material requirement | Implementation | Test / evidence | Status |
| --- | --- | --- | --- |
| Baseline and recorded execution plan | `docs/execplans/FLAGSHIP_CONTROL_PLANE_V2.md` | baseline `make ci` log; documented environment failures | Verified with limitations |
| Repository working rules / DoD | `AGENTS.md` | manual review | Implemented |
| Brand bridge and canonical tokens | `apps/web/app/globals.css`, `docs/design/BRAND_BRIDGE.md` | frontend build; external brand access 403 | Implemented; source assets blocked |
| Original phase × discipline matrix with ≥12 graph-correlated tasks | `apps/api/app/graph/workflow.py`, `apps/web/components/features/decision-matrix.tsx`, `reference-data.ts` | production frontend build; graph node IDs matched manually | Partial: definitions are static until events project each run |
| Actual routes and deep links | `apps/web/app/{runs,governance,observability,architecture}`, `runs/[id]` | Next production route manifest | Verified routes; detail depth partial |
| Operational shell, context, inspector, event shelf | `app-shell.tsx`, `mission-control.tsx`, `decision-matrix.tsx` | frontend component tests/build | Partial against full inspector contract |
| Persisted agent conversation theatre | `services/executions.py`, `decision-theatre.tsx`, `mission-control.tsx` | backend handoff regression + populated/empty frontend component tests | Implemented above the matrix for immediate discovery, with synthetic server-authored handoffs; external OSINT collection not claimed |
| Responsive layout, touch targets, reduced motion | `apps/web/app/globals.css` | production build, six-route HTTP smoke and 1440×900 rendered browser inspection | Implemented; desktop theatre placement visually verified |
| Keyboard status/approval semantics | `approval-modal.tsx`, `decision-matrix.tsx`, `status-badge.tsx` | `apps/web/tests/components.test.tsx` | Tab trap, Escape dismissal and arrow navigation verified in Vitest |
| Valid shadcn source configuration and component | `apps/web/components.json`, `components/ui/button.tsx` | lint/typecheck/build | Verified |
| Lucide, Recharts and TanStack usage | none | npm registry returned 403 | Blocked; not falsely claimed |
| Deterministic synthetic EU critical-infrastructure workflow | `workflow.py`, `mission-control.tsx` | graph/API tests added; Python dependencies unavailable | Implemented; backend execution blocked locally |
| Async creation returns persisted QUEUED ID | `services/executions.py`, `api/routes.py` | `test_async_creation_returns_queued_before_workflow_completion` | Implemented; pytest blocked |
| Fake-only observable demo delay | `config.py`, `services/executions.py`, `main.py` | async API regression test | Implemented; pytest blocked |
| Monotonic SSE and race-free catch-up | `domain.py`, `persistence/database.py`, `api/routes.py` | sequence assertions in `apps/api/tests/test_api.py` | Implemented; pytest blocked |
| Frontend SSE dedupe/order/idempotency | `types/index.ts`, `lib/telemetry.ts` | `tests/telemetry.test.ts` | Verified |
| Rejection remains CANCELLED after reload | `services/executions.py`, `mission-control.tsx`, `lib/telemetry.ts` | backend reload test + frontend reducer test | Frontend verified; backend pytest blocked |
| Cross-execution isolation | `lib/telemetry.ts` | `normalised execution isolation and idempotency` suite | Verified |
| Server-authoritative routing | routing telemetry fields and `/routing`; UI consumes event agents only | authoritative routing API test | Implemented; backend pytest blocked |
| Invocation metadata only on real model node | `services/executions.py` | invocation count and cost reconciliation API test | Implemented; backend pytest blocked |
| Async state reconciliation | `mission-control.tsx` calls `getExecution` on approval/terminal events | frontend test/build/manual code review | Implemented |
| Truthful checkpoint recovery | fake-only observer-suppressed replay in `services/executions.py`; ADR-010 and architecture docs | restart/no-duplicate regression test | Implemented; backend pytest blocked |
| Paginated/filterable executions and read surfaces | `persistence/database.py`, `api/routes.py`, `lib/api.ts`, `feature-pages.tsx` | pagination/routing API tests; frontend build | Frontend verified; backend pytest blocked |
| Append-only audit and fail-closed sovereign routing preserved | existing persistence/routing plus new projections | existing backend suites | Not rerun: Python dependency block |
| Package lock and reproducible npm CI | `apps/web/package-lock.json`, Dockerfile, Makefile, workflows | `npm ci --offline` / frontend checks | Implemented |
| Case study, recruiter script and CV evidence | `docs/showcase/` | claim review against repository paths | Implemented |
| README problem/demo/architecture/stack/limits/deploy | `README.md` | manual truthfulness review | Implemented |
| Desktop/mobile screenshots and visual regression | `docs/showcase/screenshots/README.md` | browser availability rechecked; no binary and downloads blocked | Blocked |
| Independent screenshot rubric ≥88 | `docs/design/VISUAL_QA_REPORT.md` | no screenshots available | Blocked; no score claimed |
| Lighthouse ≥85/95, CLS <0.1, Axe | none | browser tooling unavailable | Blocked |
| Playwright scenarios | none | package/browser registry unavailable | Blocked |
| Docker Compose config/build/smoke | Compose/Dockerfiles retained | Docker CLI unavailable | Blocked |
| Production deployment | owner-only workflow retained | intentionally not run | Pending owner action |

## Requirement exceptions requiring owner review

1. Restore access to the read-only brand repository, copy the canonical logo/favicon, and record
   its commit and hashes in `BRAND_BRIDGE.md`.
2. In a network/browser-enabled CI runner, install the reviewed compatible Lucide/Recharts/
   TanStack and Playwright/Axe dependencies, use them genuinely, and commit the refreshed lock.
3. Render every required state/viewport, run visual regression, Axe, Lighthouse and CLS checks,
   then commission an independent screenshot reviewer. Do not assign the requested 88 score first.
4. Run the backend suite with Python 3.12/3.13 dependencies, Docker Compose gates, first-party
   builds, smoke/security checks, and record results before production review.
