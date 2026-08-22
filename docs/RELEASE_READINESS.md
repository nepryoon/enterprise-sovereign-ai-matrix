# Release readiness

Scores must be reconciled with the latest `docs/VALIDATION_REPORT.md` before a tag.

| Area | Score | Evidence / deficiency |
|---|---:|---|
| Architecture | 5 | Invariants and ADRs documented |
| Backend | 4 | Vertical slice implemented; production load testing remains |
| Frontend | 3 | Complete implementation and test suite exist, but the proxy prevented dependency installation, production build, and screenshot. Remediation: run `npm ci && npm test && npm run typecheck && npm run build` on connected CI. This blocks claiming a locally validated release, not source review or a controlled showcase after CI passes. |
| Agent orchestration | 5 | Typed deterministic graph tests |
| HITL | 5 | Native interrupt/resume integration tests |
| Sovereign routing | 5 | No fallback and failure-path tests |
| Observability | 4 | Adapter tests; hosted credentials needed for trace verification |
| Testing | 3 | Deterministic backend/frontend suites exist, but package downloads were blocked. Remediation: run `make lint typecheck test` on connected CI. This blocks a release tag until green. |
| Security | 4 | Threat review and CI checks; external penetration test remains |
| DevOps | 3 | Compose/CI are present, but Docker is absent in the workspace. Remediation: run Compose config/build/smoke in Docker CI. This blocks deployment certification, not source completion. |
| Documentation | 5 | Architecture, operations, testing and security covered |
| FinOps | 5 | Hard-cap ledger and invocation model |
| Demo quality | 4 | Scriptable workflow; hosted performance depends on VPS |

The 3/5 validation deficiencies are hard environment limitations and must be cleared in connected CI before a release tag. Remaining 4/5 items do not block a controlled showcase, but do block claims of regulated production readiness. Production Langfuse traces, Cloudflare DNS and hosted soak validation additionally require owner-controlled infrastructure and credentials.
