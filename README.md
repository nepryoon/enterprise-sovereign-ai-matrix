# Enterprise Sovereign AI Decision Matrix

A production-shaped proof of concept for governed enterprise AI execution. It combines a deterministic LangGraph workflow, policy-controlled multi-model routing, durable Human-in-the-Loop (HITL) checkpoints, append-only audit telemetry, and a real-time Mission Control dashboard. It is an operations console—not a chatbot.

## Why this matters

Enterprises need to know **which model handled data, why it was selected, what it cost, which agent changed state, and who authorised high-risk action**. This project makes those decisions explicit, testable, observable, and reproducible while ensuring restricted workloads cannot silently escape to a cloud model.

## Capabilities

- Deterministic Enterprise Change Risk Assessment state machine with typed state and explicit transitions.
- Real LangGraph interruption and `Command(resume=...)` continuation for approval and rejection.
- Sovereignty-aware `FAST`, `BALANCED`, `REASONING`, and `SOVEREIGN` routing; sensitive traffic fails closed.
- FastAPI REST control plane, replayable SSE telemetry with heartbeats, correlation IDs, and immutable audit events.
- PostgreSQL production persistence and deterministic fake inference for zero-cost tests.
- Next.js Mission Control with live Agent Matrix, execution timeline, model routing, token/cost/latency KPIs, trace links, and an accessible approval interceptor.
- LiteLLM gateway, compact Ollama inference, and failure-isolated Langfuse instrumentation.
- Hardened, non-root first-party containers, private infrastructure services, GitHub CI, and Cloudflare Tunnel deployment.

## Architecture

```mermaid
flowchart LR
  U[Enterprise operator] --> W[Next.js Mission Control]
  W -->|REST + SSE| A[FastAPI control plane]
  A --> G[LangGraph state machine]
  G --> P[(PostgreSQL checkpoints/audit)]
  G --> R[Routing policy]
  R --> L[LiteLLM proxy]
  L --> C[Cloud model classes]
  L --> O[Ollama sovereign model]
  G -. redacted traces .-> F[Langfuse]
```

The workflow is fixed: `ingest_request → classify_sensitivity → triage → risk_analysis → policy_evaluation → approval_interrupt? → finalise/reject`. LLM output supplies analysis, never arbitrary topology. See [architecture](docs/architecture/ARCHITECTURE.md), [domain model](docs/architecture/DOMAIN_MODEL.md), and [state machine](docs/architecture/STATE_MACHINE.md).

## Quick start

### Requirements

- Docker Engine with Compose v2
- Recommended demo host: 4 CPU cores, 16 GB RAM, and 30 GB free disk
- CPU-only operation is supported; local inference can be slow

```bash
git clone <repository>
cd enterprise-sovereign-ai-matrix
cp .env.example .env
# Replace every change-me value with: openssl rand -hex 32
docker compose build
docker compose up -d
docker compose ps
```

Open Mission Control at <http://localhost:3000>, the API at <http://localhost:8000/api/docs>, and local Langfuse at <http://localhost:3001>. Pull the compact sovereign model once with:

```bash
docker compose exec ollama ollama pull qwen2.5:1.5b-instruct-q4_K_M
```

No commercial key is required for deterministic demonstration mode or the test suites. Cloud routes are opt-in through environment variables; `RUN_LIVE_LLM_TESTS=false` is the default.

## Demo workflow

Mission Control offers deterministic scenarios for a low-risk public change, a public high-risk change, restricted data, and unavailable sovereign inference. To exercise governance from a terminal:

```bash
./scripts/demo-smoke-test.sh http://localhost:8000
```

The script creates a high-risk execution, confirms it reaches `WAITING_APPROVAL`, approves it, and verifies completion. In the UI the same path opens an approval interceptor showing risk, evidence, recommendation, and operator-reason controls. Rejection follows a distinct audited abort path.

## Sovereign routing and observability

PII, restricted, and residency-constrained requests route only to the `sovereign` LiteLLM alias backed by Ollama. If that provider is unavailable, policy raises a typed failure rather than falling back to cloud. Public workloads select cost/criticality-appropriate classes.

Every execution carries an execution ID, correlation ID, and trace reference. Agent transitions record latency, tokens, estimated EUR cost, model class, and provider. Raw sensitive content is redacted before best-effort Langfuse export; observability failure never corrupts workflow state.

## Development and validation

```bash
make setup
make lint
make typecheck
make test
make build
make smoke
make security
make ci
```

Backend and frontend tests use deterministic mocks and never make paid LLM calls. CI separates backend, frontend, integration, Docker, and supply-chain checks. Consult the [test strategy](docs/testing/TEST_STRATEGY.md) and the truthful [validation report](docs/VALIDATION_REPORT.md) for executed checks and environment limitations.

## Deployment

The Compose stack includes web, API, PostgreSQL, LiteLLM, Ollama, Langfuse, ClickHouse, Redis, and object storage with health checks and named volumes. Only web/API ingress and loopback Langfuse are published; databases, gateway administration, and inference remain private.

- [Local development](docs/operations/LOCAL_DEVELOPMENT.md)
- [Hetzner-compatible deployment](docs/operations/DEPLOYMENT.md)
- [Guida completa al deployment di produzione (italiano)](docs/operations/PRODUCTION_DEPLOYMENT_GUIDE_IT.md)
- [Cloudflare Tunnel and `matrix.neuromorphicinference.com`](docs/operations/CLOUDFLARE.md)
- [Troubleshooting](docs/operations/TROUBLESHOOTING.md)

Cloudflare Tunnel can present the direct subdomain or an explicitly allow-listed iframe parent without globally weakening frame policy. DNS ownership and production credentials remain operator-controlled external actions.

## Security and cost

Secrets are environment-only; mutations are rate-limited; CORS and security headers use explicit policies; sensitive telemetry is redacted; containers drop capabilities; internal services have no public ports. This is a flagship PoC rather than a multi-tenant IAM product—place it behind Cloudflare Access for public use. Review [SECURITY.md](SECURITY.md) and the [threat model](docs/security/THREAT_MODEL.md).

The project hard cap is **EUR 250**. Open-source software, deterministic CI, a compact local model, and a small European VPS keep the expected showcase cost below that limit. See the [budget ledger](docs/finops/BUDGET.md) and [cost model](docs/finops/COST_MODEL.md).

## Showcase assets and limitations

The runnable dashboard itself is the canonical demo. Capture wide and mobile screenshots after deployment as described in the operations guide; generated screenshots are intentionally not committed as stale evidence.

Current limitations are deliberately explicit: CPU-only sovereign inference has higher latency; production authentication is delegated to Cloudflare Access; commercial provider behaviour requires opt-in credentials; and the full observability stack has a larger memory footprint than the application-only profile. See [release readiness](docs/RELEASE_READINESS.md).

## Roadmap

1. Add organisation-scoped RBAC and signed operator identities.
2. Add PostgreSQL row-level tenancy and retention controls.
3. Benchmark additional compact sovereign models and vLLM migration.
4. Add production load/chaos runs and browser E2E evidence in deployment CI.

Licensed under the [MIT License](LICENSE). Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md).
