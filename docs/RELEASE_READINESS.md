# Release readiness

Scores must be reconciled with the latest `docs/VALIDATION_REPORT.md` before a tag.

| Area | Score | Evidence / deficiency |
|---|---:|---|
| Architecture | 5 | Invariants and ADRs documented |
| Backend | 4 | Vertical slice implemented; production load testing remains |
| Frontend | 4 | Connected CI lint, type-check, Vitest and production build are green; formal accessibility audit and deployed screenshot remain. |
| Agent orchestration | 5 | Typed deterministic graph tests |
| HITL | 5 | Native interrupt/resume integration tests |
| Sovereign routing | 5 | No fallback and failure-path tests |
| Observability | 4 | Adapter tests; hosted credentials needed for trace verification |
| Testing | 4 | All eight PR checks are green; hosted smoke and soak tests remain deployment-time validation. |
| Security | 4 | Threat review and CI checks; external penetration test remains |
| DevOps | 4 | Compose validation and first-party Docker builds are green in CI; hosted deployment and DNS require owner access. |
| Documentation | 5 | Architecture, operations, testing and security covered |
| FinOps | 5 | Hard-cap ledger and invocation model |
| Demo quality | 4 | Scriptable workflow; hosted performance depends on VPS |

All areas now meet the 4/5 showcase threshold. Remaining deficiencies do not block a controlled showcase, but do block claims of regulated production readiness. Production Langfuse traces, Cloudflare DNS, accessibility evidence and hosted soak validation require owner-controlled infrastructure or follow-up review.
