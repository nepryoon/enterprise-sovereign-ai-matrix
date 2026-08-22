---
spec_id: ESAI-DM-BUILD-001
title: Enterprise Sovereign AI Decision Matrix & Multi-Agent Orchestration Engine
artifact: BUILD_SPEC.md
version: "1.0.0"
status: approved_for_autonomous_build
language:
  code_and_repo_docs: en-GB
  operator_messages: it-IT
target_showcase: "https://www.neuromorphicinference.com/"
preferred_public_host: "matrix.neuromorphicinference.com"
budget:
  currency: EUR
  hard_cap: 250
  allocation_caps:
    coding_agent_and_dev_tools: 50
    llm_api_usage: 120
    hosting_and_storage: 60
    contingency: 20
  cloudflare_tunnel_target_cost: 0
execution_mode: autonomous
human_intervention_policy: external_blockers_only
repository_strategy: monorepo
deployment_strategy: docker_compose
primary_transport: sse
---

# 1. Purpose

This file is the machine-oriented implementation contract for the autonomous build of the
**Enterprise Sovereign AI Decision Matrix & Multi-Agent Orchestration Engine**.

The autonomous coding agent MUST treat this file as the implementation source of truth after
the Master Autonomous Build Prompt.

The objective is not to produce a design-only deliverable. The objective is to produce a
working, tested, documented, containerised and showcase-ready repository.

# 2. Normative language

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are normative.

Priority order:

1. Master Autonomous Build Prompt.
2. This `BUILD_SPEC.md`.
3. Files under `docs/reference/`.
4. Accepted ADRs.
5. Current official upstream documentation.
6. Engineering judgement.

If sources conflict, the agent MUST create an ADR and continue autonomously unless an external
credential, billing, DNS, legal acceptance or equivalent human-only action is required.

# 3. Version baseline

The following versions were verified as current baselines on 2026-08-22 and SHOULD be used as
the initial compatibility target.

| Component | Validated baseline | Policy |
|---|---:|---|
| Next.js | 16.3.x | Use latest compatible 16.3 security patch at bootstrap; lock exact version |
| FastAPI | 0.141.1 | Use exact compatible version resolved by Python lockfile |
| LangGraph | 1.2.10 | Use exact version unless a newer security/bugfix patch is required |
| LiteLLM | 1.96.0 | Prefer stable proxy image/release; lock immutable image tag/digest |
| Langfuse Python SDK | 4.14.3 | Must be compatible with self-hosted Langfuse v4 |
| Langfuse server | v4 stable | Use a stable v4 release supported by official self-hosting docs |
| Python | 3.13.x preferred | 3.12 MAY be selected if a dependency requires it |
| Node.js | current supported LTS compatible with Next.js 16.3 | Lock via `.nvmrc` or equivalent |
| PostgreSQL | 16.x | Required for demo/production deployment |
| Redis | 7.2+ if required by Langfuse | Internal only |
| ClickHouse | >=25.12; 26.4+ preferred for Langfuse v4 | Internal only |

The agent MUST verify official upstream documentation before relying on version-specific APIs.
The agent MUST generate deterministic lockfiles.

# 4. Product objective

The system MUST demonstrate all of the following in one coherent vertical slice:

- enterprise multi-agent orchestration;
- deterministic state-machine transitions;
- durable workflow checkpoints;
- Human-in-the-Loop interruption and resume;
- multi-LLM policy routing;
- local/sovereign inference route for sensitive workloads;
- fail-closed behaviour for sensitive workloads if sovereign inference is unavailable;
- real-time execution telemetry;
- token, latency, provider and cost metrics;
- execution lineage and auditability;
- Langfuse trace correlation;
- GitHub-native development and CI;
- containerised deployment on a low-cost European VPS;
- a polished enterprise Mission Control interface.

# 5. Non-goals

The PoC MUST NOT introduce the following unless required by hard evidence:

- Kubernetes;
- service mesh;
- distributed event bus;
- CQRS;
- microservice decomposition beyond independently deployable components already required by
  Next.js, FastAPI, LiteLLM, Ollama and Langfuse;
- GPU-only runtime requirements;
- paid LLM calls in normal CI;
- arbitrary dynamic graph topology decided by an LLM;
- direct internet exposure of PostgreSQL, Ollama, LiteLLM administrative endpoints,
  ClickHouse or Redis.

# 6. Architecture contract

Logical flow:

```text
Browser / Mission Control
        |
        | HTTPS
        v
Next.js 16.3
        |
        +---------- REST commands ----------+
        |                                   |
        +---------- SSE telemetry ----------+
                                            v
                                      FastAPI API
                                            |
                                            v
                                  LangGraph State Engine
                                      /      |      \
                                     /       |       \
                            Checkpoint   Policy       Audit
                                |           |           |
                                v           v           v
                           PostgreSQL    LiteLLM     PostgreSQL
                                             |
                           +-----------------+-----------------+
                           |                 |                 |
                         FAST            REASONING         SOVEREIGN
                      cloud model       cloud model         Ollama
                                             |
                                             v
                                          Langfuse
```

## 6.1 Architecture invariants

ARCH-INV-001: Workflow transitions MUST be explicit and testable.

ARCH-INV-002: LLM outputs MUST NOT directly control arbitrary graph topology.

ARCH-INV-003: Every execution MUST carry both `execution_id` and `correlation_id`.

ARCH-INV-004: Material state MUST survive API process restart.

ARCH-INV-005: HITL MUST use LangGraph-supported interrupt/resume semantics for the installed
version, isolated behind an adapter if the upstream API is version-sensitive.

ARCH-INV-006: Application nodes MUST use the gateway abstraction rather than provider-specific
SDK calls in domain logic.

ARCH-INV-007: Sensitive workloads classified as requiring sovereignty MUST NOT silently fall
back to cloud inference.

ARCH-INV-008: Failure of Langfuse MUST NOT make the business workflow fail.

ARCH-INV-009: Default automated tests MUST run with deterministic fake inference.

ARCH-INV-010: Production/demo deployment MUST use PostgreSQL rather than SQLite.

# 7. Repository contract

The repository MUST use this logical monorepo shape:

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── feature.yml
│   │   ├── bug.yml
│   │   └── technical-task.yml
│   ├── pull_request_template.md
│   ├── CODEOWNERS
│   └── workflows/
│       ├── backend-ci.yml
│       ├── frontend-ci.yml
│       ├── integration-ci.yml
│       ├── security.yml
│       └── docker.yml
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── agents/
│   │   │   ├── graph/
│   │   │   ├── routing/
│   │   │   ├── services/
│   │   │   ├── telemetry/
│   │   │   ├── persistence/
│   │   │   ├── observability/
│   │   │   ├── security/
│   │   │   └── main.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   └── web/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       ├── types/
│       ├── tests/
│       ├── package.json
│       └── Dockerfile
├── packages/
│   └── contracts/
├── config/
│   └── litellm/
│       └── config.yaml
├── infra/
│   ├── cloudflare/
│   ├── docker/
│   └── scripts/
├── tests/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── reference/
│   ├── architecture/
│   ├── adr/
│   ├── security/
│   ├── operations/
│   ├── finops/
│   └── testing/
├── scripts/
├── BUILD_SPEC.md
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .gitignore
├── Makefile
├── README.md
├── SECURITY.md
├── CONTRIBUTING.md
└── LICENSE
```

The agent MAY adjust the physical layout only if it creates an ADR demonstrating a material
benefit.

# 8. Domain model

The implementation MUST define typed representations for:

- `Execution`
- `AgentRun`
- `Decision`
- `ApprovalRequest`
- `ApprovalDecision`
- `RoutingDecision`
- `ModelInvocation`
- `TelemetryEvent`
- `AuditEvent`
- `TraceReference`
- `CostRecord`

Every `Execution` MUST include:

```yaml
execution_id: uuid
correlation_id: uuid
created_at: datetime_utc
updated_at: datetime_utc
status: enum
risk_level: enum
data_sensitivity: enum
current_node: string
```

# 9. State machine

Allowed top-level execution states:

```yaml
states:
  - QUEUED
  - RUNNING
  - WAITING_APPROVAL
  - COMPLETED
  - FAILED
  - CANCELLED
```

Minimum transition rules:

```yaml
transitions:
  QUEUED: [RUNNING, CANCELLED]
  RUNNING: [WAITING_APPROVAL, COMPLETED, FAILED, CANCELLED]
  WAITING_APPROVAL: [RUNNING, FAILED, CANCELLED]
  COMPLETED: []
  FAILED: []
  CANCELLED: []
```

Illegal transitions MUST produce a typed domain error and MUST NOT mutate persisted state.

# 10. Demonstration workflow

The primary demo workflow MUST be:

**Enterprise Change Risk Assessment**

Nominal graph:

```text
ingest_request
  -> classify_sensitivity
  -> triage
  -> risk_analysis
  -> policy_evaluation
  -> if high risk: approval_interrupt
  -> finalise | reject
```

The demo MUST include four deterministic scenarios:

```yaml
demo_scenarios:
  public_low_risk:
    sensitivity: PUBLIC
    expected_route: FAST
    approval_required: false
    terminal_state: COMPLETED

  public_high_risk:
    sensitivity: PUBLIC
    expected_route: REASONING
    approval_required: true
    terminal_state_after_approval: COMPLETED

  restricted_sensitive:
    sensitivity: RESTRICTED
    expected_route: SOVEREIGN
    approval_required: true

  sovereign_provider_failure:
    sensitivity: RESTRICTED
    expected_route: SOVEREIGN
    sovereign_available: false
    expected_behaviour: FAIL_CLOSED
```

# 11. Routing policy

Model classes MUST be domain abstractions:

```yaml
model_classes:
  FAST:
    purpose: low_cost_triage
  BALANCED:
    purpose: standard_analysis
  REASONING:
    purpose: high_criticality_reasoning
  SOVEREIGN:
    purpose: sensitive_or_residency_constrained_inference
```

Minimum routing decision inputs:

```yaml
routing_inputs:
  - task_criticality
  - data_sensitivity
  - reasoning_requirement
  - latency_objective
  - cost_constraint
  - provider_availability
```

Mandatory policy:

```yaml
routing_policy:
  - when: "criticality == LOW and sensitivity == PUBLIC"
    route: FAST

  - when: "criticality == MEDIUM and sensitivity in [PUBLIC, INTERNAL]"
    route: BALANCED

  - when: "criticality == HIGH and sensitivity not in [PII, RESTRICTED, SOVEREIGN]"
    route: REASONING

  - when: "sensitivity in [PII, RESTRICTED, SOVEREIGN]"
    route: SOVEREIGN
    fallback: NONE
    on_unavailable: FAIL_CLOSED
```

Provider/model names MUST be configuration, not domain constants.

# 12. LiteLLM contract

LiteLLM MUST expose logical aliases:

```yaml
aliases:
  - fast
  - balanced
  - reasoning
  - sovereign
```

`sovereign` MUST resolve to an Ollama-compatible local endpoint.

Cloud provider credentials MUST only be read from environment variables or a supported secret
store.

The proxy configuration MUST define appropriate:

- timeouts;
- retries;
- health checks;
- allowed fallbacks;
- cost metadata where supported.

Sovereign workloads MUST NOT have a cloud fallback.

# 13. Inference abstraction

The backend MUST define an inference interface that can be replaced by:

- LiteLLM-backed live inference;
- deterministic fake inference.

The deterministic fake MUST support:

```yaml
fake_scenarios:
  - SAFE
  - HIGH_RISK
  - SENSITIVE
  - PROVIDER_FAILURE
  - TIMEOUT
  - MALFORMED_RESPONSE
```

All fake responses MUST be reproducible.

# 14. API contract

Base path:

`/api/v1`

Mandatory endpoints:

```yaml
endpoints:
  - method: POST
    path: /executions
    purpose: create_and_start_execution

  - method: GET
    path: /executions/{execution_id}
    purpose: get_execution

  - method: GET
    path: /executions/{execution_id}/events
    purpose: get_persisted_execution_events

  - method: GET
    path: /executions/{execution_id}/stream
    purpose: sse_telemetry_stream

  - method: POST
    path: /executions/{execution_id}/approve
    purpose: approve_waiting_execution

  - method: POST
    path: /executions/{execution_id}/reject
    purpose: reject_waiting_execution

  - method: GET
    path: /health/live
    purpose: liveness

  - method: GET
    path: /health/ready
    purpose: readiness
```

Approval/rejection MUST fail with a conflict-style response if the execution is not in
`WAITING_APPROVAL`.

Approval payload:

```json
{
  "actor": "operator",
  "reason": "Risk accepted for controlled demonstration"
}
```

# 15. SSE event contract

The SSE stream MUST emit JSON payloads conforming to a versioned schema.

Required fields:

```yaml
TelemetryEvent:
  schema_version: string
  event_id: uuid
  execution_id: uuid
  correlation_id: uuid
  timestamp: datetime_utc
  event_type: string
  agent_id: string|null
  status: string|null
  model_class: string|null
  provider: string|null
  latency_ms: integer|null
  prompt_tokens: integer|null
  completion_tokens: integer|null
  estimated_cost_eur: number|null
  trace_id: string|null
```

Required event types:

```yaml
event_types:
  - execution.started
  - agent.started
  - agent.completed
  - agent.failed
  - routing.selected
  - approval.requested
  - approval.approved
  - approval.rejected
  - execution.completed
  - execution.failed
```

The server MUST provide heartbeat events/comments.
The client MUST implement reconnection behaviour.
The UI SHOULD use `Last-Event-ID` recovery if the chosen implementation supports it cleanly.

# 16. HITL requirements

HITL is a runtime requirement, not a visual simulation.

HITL-001: A high-risk workflow MUST enter `WAITING_APPROVAL`.

HITL-002: The graph MUST persist a resumable checkpoint.

HITL-003: Approval MUST resume from the interrupted workflow.

HITL-004: Rejection MUST follow an explicit reject/abort path.

HITL-005: Approval and rejection MUST create immutable audit events.

HITL-006: The backend MUST reject duplicate or out-of-state approval operations.

HITL-007: The UI MUST display the evidence, risk level, proposed action and decision controls.

# 17. Persistence

PostgreSQL MUST persist at minimum:

- execution metadata;
- workflow checkpoint references/state as supported by the LangGraph checkpointer;
- audit events;
- telemetry events required for replay;
- routing decisions;
- cost records;
- approval decisions.

Audit history MUST be append-oriented.

The application MUST use migrations.

# 18. Observability and Langfuse

Langfuse MUST be self-hosted.

The selected Langfuse v4 deployment MUST follow current official infrastructure requirements.
For the validated v4 baseline, this implies ClickHouse, PostgreSQL and Redis-compatible
dependencies according to the chosen official compose/deployment pattern.

Instrument:

```yaml
trace_dimensions:
  - execution
  - agent_or_node
  - llm_invocation
  - routing_decision
  - latency
  - prompt_tokens
  - completion_tokens
  - estimated_cost
  - error
```

Correlation requirements:

```yaml
correlation:
  execution_id: required
  correlation_id: required
  trace_id: required_when_available
  agent_id: required_for_agent_events
```

Langfuse outages MUST degrade observability only; they MUST NOT corrupt or abort an otherwise
valid business workflow.

Sensitive raw content SHOULD be redacted before export.

# 19. Frontend contract

Technology:

```yaml
frontend:
  framework: Next.js
  router: App Router
  language: TypeScript
  styling: Tailwind CSS
  components:
    - shadcn/ui
    - Tremor_where_useful
  realtime: SSE
```

The application MUST be an enterprise operations console, not a chatbot.

Required views/components:

- Mission Control shell;
- KPI summary;
- active executions;
- Agent Matrix;
- execution timeline;
- routing/sovereignty panel;
- cost/token panel;
- latency and success-rate telemetry;
- Langfuse trace reference/link;
- HITL approval interceptor/modal;
- loading, reconnecting and failure states.

Agent Matrix columns:

```yaml
agent_matrix_columns:
  - Agent
  - Role
  - Status
  - ModelClass
  - Provider
  - Latency
  - PromptTokens
  - CompletionTokens
  - Cost
  - Outcome
```

# 20. Security requirements

Minimum controls:

```yaml
security:
  secrets_in_git: forbidden
  production_debug: forbidden
  cors: explicit_allowlist
  input_validation: required
  secure_headers: required
  rate_limiting: required_for_public_mutating_endpoints
  telemetry_redaction: required_for_sensitive_fields
  docker_socket_mount: forbidden
  container_root_user: avoid_where_practical
  database_public_port: forbidden
  ollama_public_port: forbidden
  litellm_admin_public_port: forbidden
  clickhouse_public_port: forbidden
  redis_public_port: forbidden
```

The agent MUST create `docs/security/THREAT_MODEL.md` and `SECURITY.md`.

At minimum assess:

- secret leakage;
- prompt/tool injection boundaries;
- approval bypass;
- insecure direct object reference;
- sensitive telemetry exposure;
- model gateway credential exposure;
- public internal services;
- unsafe model output trust;
- container privilege issues.

# 21. Cost accounting

A backend service equivalent to `CostCalculator` MUST calculate or store:

```yaml
cost_record:
  execution_id: uuid
  model_class: string
  provider: string
  model: string
  prompt_tokens: integer
  completion_tokens: integer
  cached_tokens: integer|null
  latency_ms: integer
  estimated_cost_eur: number
  pricing_source_or_version: string|null
```

The frontend MUST consume calculated cost data; it MUST NOT implement pricing logic.

The repository MUST maintain `docs/finops/BUDGET.md`.

Budget enforcement rules:

```yaml
budget_rules:
  hard_project_cap_eur: 250
  live_llm_tests_default: false
  paid_calls_in_ci: forbidden
  api_usage_soft_alert_eur: 80
  api_usage_stop_and_review_eur: 120
```

# 22. Local inference

Ollama MUST demonstrate the sovereign route.

The build agent MUST select a current compact instruct/reasoning model compatible with the
available CPU/RAM envelope and record the choice in an ADR.

The repository MUST document:

- model identifier;
- parameter count/class;
- quantisation;
- approximate RAM requirement;
- intended use;
- CPU-only latency limitations.

Model weights MUST NOT be committed to Git.

# 23. Docker Compose

The final deployment MUST include at least these logical services:

```yaml
services_required:
  - web
  - api
  - postgres
  - litellm
  - ollama
  - langfuse
```

The agent MUST add all officially required Langfuse v4 dependencies.

Compose requirements:

- health checks;
- named persistent volumes;
- internal networks;
- restart policies;
- environment-variable secrets;
- no unnecessary public ports;
- non-floating image tags;
- `docker compose config` success;
- successful image builds for first-party services.

# 24. Cloudflare and public exposure

Target public flow:

```text
Internet
  -> Cloudflare
  -> Cloudflare Tunnel
  -> web / API ingress
  -> private Docker network
```

Preferred showcase hostname:

`matrix.neuromorphicinference.com`

The repository MUST include instructions/configuration templates for Cloudflare Tunnel.

Only the intended application surface MAY be public.

If iframe embedding is implemented, CSP `frame-ancestors` MUST allow only the intended parent
origin rather than disabling framing protection globally.

# 25. Testing contract

## 25.1 Backend unit tests

Mandatory tests include:

```yaml
backend_tests:
  - test_low_risk_transition
  - test_high_risk_requires_approval
  - test_rejected_execution_aborts
  - test_approved_execution_resumes
  - test_sensitive_data_routes_sovereign
  - test_public_low_risk_routes_fast
  - test_illegal_transition_rejected
  - test_model_failure_recorded
  - test_checkpoint_resume
  - test_cost_calculation
```

## 25.2 Frontend tests

Mandatory test classes:

```yaml
frontend_tests:
  - agent_matrix_rendering
  - sse_event_reducer
  - status_transition_rendering
  - reconnect_state
  - hitl_modal
  - approve_action
  - reject_action
  - error_state
```

## 25.3 Integration tests

Mandatory integration coverage:

```yaml
integration_tests:
  - fastapi_to_langgraph
  - langgraph_to_persistence
  - routing_to_fake_inference
  - fastapi_to_sse
  - hitl_interrupt_to_api_approval_to_resume
  - telemetry_persistence
  - langfuse_adapter_degraded_mode
```

## 25.4 End-to-end smoke test

A reproducible script MUST demonstrate:

```text
create execution
-> consume SSE
-> observe WAITING_APPROVAL
-> approve
-> resume
-> observe COMPLETED
```

Recommended path:

`scripts/demo-smoke-test.sh`

# 26. Test economics

Normal test execution MUST NOT require:

- OpenAI API;
- Anthropic API;
- any paid remote LLM;
- downloaded large local model.

Live tests MUST be opt-in:

```env
RUN_LIVE_LLM_TESTS=false
```

CI MUST keep this false.

# 27. Quality gates

Python baseline:

```yaml
python_quality:
  formatter_linter: ruff
  tests: pytest
  async_tests: pytest-asyncio
  coverage: coverage_or_pytest_cov
  typecheck: mypy_or_pyright
  core_domain_coverage_target_percent: 80
```

Frontend baseline:

```yaml
frontend_quality:
  typescript_strict: true
  lint: eslint_or_supported_equivalent
  component_tests: required
  production_build: required
```

A failing valid test MUST be fixed, not disabled.

# 28. GitHub-native workflow

Required repository files:

- issue forms for Feature, Bug and Technical Task;
- pull request template;
- CODEOWNERS;
- backend CI;
- frontend CI;
- integration CI;
- security CI;
- Docker build CI.

Technical task template MUST contain:

```yaml
technical_task_fields:
  - Context
  - Objective
  - Scope
  - AcceptanceCriteria
  - Tests
  - Dependencies
  - Risks
  - DefinitionOfDone
```

If GitHub CLI is authenticated, the autonomous agent SHOULD create and update issues.
If not, it MUST maintain `docs/IMPLEMENTATION_PLAN.md` and continue without blocking.

# 29. CI requirements

Backend CI:

- install from lockfile;
- lint;
- typecheck;
- unit tests;
- coverage.

Frontend CI:

- install from lockfile;
- lint;
- typecheck;
- tests;
- production build.

Integration CI:

- start required lightweight services;
- run deterministic integration tests;
- MUST NOT call paid LLM APIs.

Security CI:

- secret scan;
- Python dependency audit;
- Node dependency audit;
- container/dependency vulnerability scan where practical.

Docker CI:

- validate Compose;
- build first-party images.

# 30. Required documentation

The build is incomplete without:

```text
README.md
docs/IMPLEMENTATION_PLAN.md
docs/VALIDATION_REPORT.md
docs/RELEASE_READINESS.md

docs/architecture/ARCHITECTURE.md
docs/architecture/DOMAIN_MODEL.md
docs/architecture/STATE_MACHINE.md

docs/operations/LOCAL_DEVELOPMENT.md
docs/operations/DEPLOYMENT.md
docs/operations/CLOUDFLARE.md
docs/operations/TROUBLESHOOTING.md

docs/testing/TEST_STRATEGY.md

docs/security/THREAT_MODEL.md

docs/finops/BUDGET.md
docs/finops/COST_MODEL.md
```

# 31. Required ADR baseline

Create at minimum:

```yaml
adrs:
  - ADR-001-monorepo
  - ADR-002-sse-over-websockets
  - ADR-003-postgresql-persistence
  - ADR-004-litellm-gateway
  - ADR-005-sovereign-fail-closed
  - ADR-006-langgraph-orchestration
  - ADR-007-langfuse-observability
```

Additional ADRs SHOULD be created only for material architectural decisions.

# 32. Autonomous implementation phases

```yaml
phases:
  - id: P0
    name: Discovery_and_Baseline
    deliverables:
      - repository_inventory
      - reference_document_review
      - architecture_baseline
      - ADR_baseline
      - budget_ledger
      - implementation_backlog
    exit_gate:
      - requirements_mapped
      - no_unresolved_architectural_blocker

  - id: P1
    name: Core_Graph
    deliverables:
      - backend_skeleton
      - typed_state
      - domain_models
      - langgraph_workflow
      - checkpointing
      - fake_llm
      - hitl_interrupt_resume
      - unit_tests
    exit_gate:
      - graph_tests_green

  - id: P2
    name: Multi_LLM_Gateway
    deliverables:
      - routing_policy
      - litellm_config
      - ollama_sovereign_route
      - fail_closed_policy
      - routing_tests
    exit_gate:
      - routing_tests_green_without_paid_api

  - id: P3
    name: API_and_SSE
    deliverables:
      - execution_api
      - approval_api
      - event_api
      - sse_stream
      - persistence
      - correlation_ids
    exit_gate:
      - api_graph_sse_integration_green

  - id: P4
    name: Mission_Control
    deliverables:
      - dashboard
      - agent_matrix
      - telemetry_cards
      - timeline
      - routing_panel
      - hitl_modal
      - sse_client
    exit_gate:
      - frontend_tests_green
      - frontend_typecheck_green
      - production_build_green

  - id: P5
    name: Observability
    deliverables:
      - langfuse_self_hosted
      - trace_correlation
      - token_latency_cost_capture
      - redaction
    exit_gate:
      - demo_trace_generated_or_environment_limitation_documented

  - id: P6
    name: Deployment
    deliverables:
      - production_dockerfiles
      - docker_compose
      - health_checks
      - volumes
      - cloudflare_tunnel_template
      - deployment_runbook
    exit_gate:
      - docker_compose_config_green
      - first_party_images_build

  - id: P7
    name: Hardening
    deliverables:
      - full_lint
      - typecheck
      - unit_tests
      - integration_tests
      - security_scans
      - architecture_review
      - threat_review
    exit_gate:
      - no_known_showstopper

  - id: P8
    name: Showcase_Release
    deliverables:
      - polished_readme
      - demo_instructions
      - validation_report
      - release_readiness
      - budget_report
    exit_gate:
      - definition_of_done_satisfied
```

The autonomous agent MUST proceed from one phase to the next without asking for routine approval.

# 33. Required Make targets

Where appropriate, provide working commands equivalent to:

```text
make setup
make lint
make typecheck
make test
make test-integration
make build
make up
make down
make logs
make smoke
make security
make ci
```

A target MUST NOT be added if it does not work.

# 34. Definition of Done

## Repository

- [ ] monorepo coherent and reproducible
- [ ] dependency lockfiles committed
- [ ] `.env.example` present
- [ ] no secrets committed

## Backend

- [ ] FastAPI starts
- [ ] LangGraph workflow runs
- [ ] deterministic transition validation implemented
- [ ] PostgreSQL persistence works
- [ ] checkpoint resume works
- [ ] HITL interrupt works
- [ ] approve resumes
- [ ] reject follows explicit reject path
- [ ] sovereign fail-closed works
- [ ] SSE emits valid versioned events

## Gateway

- [ ] LiteLLM starts
- [ ] logical aliases implemented
- [ ] Ollama route implemented
- [ ] provider secrets are environment-driven

## Frontend

- [ ] Next.js production build succeeds
- [ ] Mission Control renders
- [ ] Agent Matrix renders
- [ ] SSE updates state
- [ ] HITL modal works
- [ ] approve/reject actions work
- [ ] disconnect/error states are represented

## Observability

- [ ] Langfuse self-hosted deployment configured
- [ ] executions correlate to trace IDs
- [ ] latency/token/cost metadata captured when available
- [ ] observability failure degrades safely

## Testing

- [ ] unit tests green
- [ ] transition tests green
- [ ] routing tests green
- [ ] HITL tests green
- [ ] frontend tests green
- [ ] integration tests green
- [ ] smoke test green, or a genuine environment limitation is documented

## CI

- [ ] GitHub Actions configured
- [ ] default CI uses no paid LLM
- [ ] lint/typecheck/test/build automated

## Docker

- [ ] `docker compose config` succeeds
- [ ] first-party images build
- [ ] health checks configured
- [ ] persistent state uses named volumes
- [ ] internal services are not unnecessarily public

## Security

- [ ] threat model exists
- [ ] secret scanning configured
- [ ] dependency checks configured
- [ ] sensitive telemetry policy enforced
- [ ] no known approval bypass

## Documentation

- [ ] README complete
- [ ] architecture complete
- [ ] deployment runbook complete
- [ ] test strategy complete
- [ ] threat model complete
- [ ] budget report complete
- [ ] validation report complete
- [ ] release-readiness report complete

# 35. Validation report contract

`docs/VALIDATION_REPORT.md` MUST record executed evidence rather than claims.

Each validation entry MUST contain:

```yaml
validation_entry:
  command: string
  result: PASS|FAIL|BLOCKED
  timestamp: datetime_utc
  relevant_output: string
  limitation: string|null
```

The agent MUST NOT state that tests, Docker, deployment or integration work unless the
corresponding validation actually ran successfully.

# 36. Release readiness contract

Score each dimension from 0 to 5:

```yaml
release_dimensions:
  - Architecture
  - Backend
  - Frontend
  - AgentOrchestration
  - HITL
  - SovereignRouting
  - Observability
  - Testing
  - Security
  - DevOps
  - Documentation
  - FinOps
  - DemoQuality
```

Any score below 4 MUST include deficiency, cause, remediation and whether it blocks showcase.

# 37. External blocker policy

Valid external blockers include only actions such as:

- unavailable credentials;
- purchasing infrastructure;
- billing acceptance;
- DNS ownership/action;
- OAuth/account approval;
- legal terms requiring human acceptance.

When blocked, the agent MUST:

1. finish every unblocked task;
2. record the blocker;
3. provide the exact human action needed;
4. provide the exact command that resumes execution;
5. never use the blocker to stop unrelated implementation.

# 38. Prohibited shortcuts

The final core implementation MUST NOT contain unresolved:

```text
TODO
FIXME
pass
NotImplementedError
disabled valid tests
fake production endpoints
commented-out substitute implementations
hard-coded credentials
silent sovereign-to-cloud fallback
```

# 39. Git discipline

The autonomous agent SHOULD create small coherent commits with conventional prefixes, e.g.:

```text
feat(api): implement execution state machine
test(graph): cover HITL resume flow
feat(web): add realtime agent matrix
feat(gateway): enforce sovereign fail-closed routing
chore(ci): add deterministic integration pipeline
docs(architecture): document routing policy
```

Every delegated/subagent contribution MUST be reviewed and tested by the coordinating agent
before integration.

# 40. Completion conditions

The autonomous run MAY terminate only when one of these is true:

```yaml
termination:
  SUCCESS:
    condition: all_applicable_definition_of_done_items_satisfied

  EXTERNAL_BLOCKER:
    condition: human_only_external_action_required
    obligations:
      - finish_all_unblocked_work
      - document_exact_action
      - document_resume_command

  HARD_ENVIRONMENT_LIMITATION:
    condition: execution_environment_prevents_validation
    obligations:
      - identify_unvalidated_area
      - explain_reason
      - provide_available_evidence
      - provide_exact_manual_verification_steps
```

The agent MUST NOT terminate merely because a plan, architecture, scaffold or single phase has
been completed.

# 41. First autonomous actions

On first run the coding agent MUST immediately:

1. read the Master Autonomous Build Prompt;
2. read this `BUILD_SPEC.md`;
3. recursively inspect `docs/reference/`;
4. inspect repository and Git status;
5. detect Python, Node, package manager, Docker and GitHub CLI availability;
6. validate dependency/API assumptions against available current documentation;
7. create the architecture baseline and ADRs;
8. create `docs/IMPLEMENTATION_PLAN.md`;
9. initialise the budget ledger;
10. scaffold the monorepo;
11. implement Phase P1;
12. run tests;
13. repair failures;
14. continue to P2 and subsequent phases without requesting routine approval.

# 42. Governing optimisation order

When trade-offs are unavoidable, apply:

```text
correctness > cosmetic completeness
security > convenience
sovereignty guarantee > cloud fallback convenience
deterministic tests > paid live-model tests
working vertical slice > broad unfinished scaffolding
simple architecture > gratuitous infrastructure
documented limitation > fake success
```
