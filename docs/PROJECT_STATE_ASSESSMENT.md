# Project state assessment

Assessment date: 2026-10-11. Repository HEAD: `9345dda` (merge of PR #13, committed 2026-08-24).
Status: complete for this session (2026-10-11). Every section was written at the end of its step.

Labels: **VERIFIED** (command run here, result quoted), **READ IN CODE** (file and line inspected,
not executed), **STATED IN DOCS** (repository text, not checked), **ASSUMPTION** (inference stated
as such). Raw logs were kept outside the repository in the session scratch directory; only the
useful lines are quoted.

## 1. Environment

| Item | Value | Label |
|---|---|---|
| OS | Linux 7.0.0-38-generic, 14 CPU | VERIFIED (`nproc`, environment) |
| RAM | 30 GiB total, 12 GiB available with the other project's containers running; swap 5.0/8.0 GiB used | VERIFIED (`free -h`) |
| Disk | 134 GB free on `/` (Docker data on the same filesystem) | VERIFIED (`df -h`) |
| Docker / Compose | Docker 29.8.2, Compose v5.6.0 | VERIFIED |
| Node / npm | Node 24.21.0, npm 11.19.0 (repository pins Node 22.18.0 in `.nvmrc` and Dockerfile) | VERIFIED |
| Python | System 3.14.4; a `uv` virtual environment with CPython 3.13 was created in `apps/api/.venv` (ignored by git) to match CI and the API image | VERIFIED |
| GNU Make | **not installed** (`make: command not found`). Every Makefile recipe was executed by running its commands verbatim | VERIFIED |
| pip-audit | not installed system-wide; installed into the ignored virtual environment to execute the security recipe | VERIFIED |
| Browser | `/usr/bin/google-chrome` present; Playwright not installed globally | VERIFIED (`which`) |
| Ollama | not installed on the host; only the Compose `ollama/ollama:0.11.4` image can provide it | VERIFIED (`which ollama` empty) |
| Ports | 8000 taken by `ocor-bootstrap-typedb-1`; 3030, 8080, 8181, 8200 and others taken by `ocor-*`; **3000 and 3001 free** | VERIFIED (`ss -ltn`, `docker ps`) |
| Other workloads | 29 `ocor-*` containers running; not touched | VERIFIED (`docker ps`) |

Differences from the README that this assessment had to introduce: the API is published on a host
port other than 8000 through an untracked `docker-compose.override.yml`; `make` is replaced by its
recipes.

What can be verified here: lint, type checks, unit/integration tests, production build, Compose
configuration, local API runs, the Compose stack (resources permitting), local Ollama inference on
CPU, a real headless browser (Chrome), GET requests to the public demo. What cannot: the production
host itself (which commit, which `.env`, which inference mode), the Cloudflare configuration, the
self-hosted runner's `deploy-sovereign-matrix` script (not in the repository), GitHub Actions run
history beyond what `gh` exposes, and any cloud model route (no key supplied; none used).

## 2. Reading notes (documents and code)

Documents were read in the requested order. The facts that matter for the public claims:

- **Only one graph node does anything.** Of the 16 LangGraph nodes, `classify_sensitivity`,
  `triage`, `risk_analysis`, `policy_evaluation`, `approval_interrupt`, `finalise` and `reject`
  compute state; the other nine (`scope_architecture`, `threat_classification`, `cost_envelope`,
  `architecture_assessment`, `compliance_assessment`, `finops_assessment`,
  `resilience_assessment`, `challenge_analysis`, `ingest_request`) only return
  `{"current_node": ...}`. READ IN CODE (`apps/api/app/graph/workflow.py:137-219`).
- **The "agent conversation" is fixed text.** Every Decision Theatre message comes from the
  constant `AGENT_BRIEFINGS` table, independent of the run's content. The UI labels each message
  `SYNTHETIC`. READ IN CODE (`apps/api/app/services/executions.py:29-150`,
  `apps/web/components/features/decision-theatre.tsx:70`).
- **Fake inference records real provider names.** `DeterministicFakeInference` returns
  `latency_ms=25`, `prompt_tokens=len(prompt.split())`, `completion_tokens=len(output.split())` and
  copies `route.provider` (`ollama` or `litellm`) and `route.model` into the invocation. Nothing in
  the event, the execution, `/runtime` or the UI says the call was simulated. READ IN CODE
  (`apps/api/app/agents/inference.py:33-47`, `apps/api/app/api/routes.py:126-133`).
- **Which model the guided scenario uses depends on a keyword.** `HIGH_RISK` sets criticality
  HIGH; with a non-sensitive request the policy selects `REASONING`, which
  `config/litellm/config.yaml` maps to `openai/o4-mini` (the smoke script's request takes this
  path). The UI's prefilled request ends "…for sovereign deployment.", and the classifier treats
  the substring `sovereign` as RESTRICTED, so the browser's guided run routes to SOVEREIGN/Ollama.
  READ IN CODE (`workflow.py:149-178`, `routing/policy.py`), confirmed in §4c and §5.
- **Fail-closed is driven by a static flag, not by provider health.** `RoutingPolicy` raises only
  when `SOVEREIGN_AVAILABLE=false`. With the flag true and Ollama down, the LiteLLM call fails,
  `ProviderUnavailableError` is raised and the run goes to `FAILED`; there is no cloud fallback for
  `sovereign` in LiteLLM (`fallbacks` only lists `fast: [balanced]`). Both paths stop the run.
  READ IN CODE.
- **Cost is a class-level constant table**, not a provider/model price list: four rates in
  `CostCalculator.RATES`, `pricing_source_or_version="poc-2026-08"`, SOVEREIGN = 0. `COST_MODEL.md`
  describes per-provider/model versioned prices, cached-input prices, an explicit EUR conversion
  source and "unknown pricing reported as unavailable"; none of this exists. READ IN CODE
  (`apps/api/app/services/cost.py`).
- **Audit is append-only by convention.** `Repository` only inserts into `audit_events` and has no
  update/delete method, but there is no database-level protection (no trigger, no revoked
  privilege, no hash chain); the `executions` row is a mutable JSON payload. READ IN CODE
  (`apps/api/app/persistence/database.py`).
- **The actor is not an identity.** The API accepts any `actor` string; the web client always
  sends `"operator"`. READ IN CODE (`apps/api/app/api/schemas.py`, `apps/web/lib/api.ts:44`).
  An empty operator rationale is replaced by `"approve recorded by control-plane operator"`
  (`mission-control.tsx:82`), so the UI never records an absent reason as absent.
- **Approval is only possible from the browser tab that started the run.** Governance lists pending
  runs but links to `/runs/{id}`, which has no approve/reject controls; the Command Centre keeps
  the active execution only in React state (no URL parameter), so a reload loses it. READ IN CODE
  (`feature-pages.tsx`, `mission-control.tsx`).
- **Run Detail mislabels the system reason as the operator's.** It shows
  `approval_reason` ("High-risk policy threshold reached", set by the graph) under "Operator
  rationale"; the operator's actual reason is only in the audit list, which the page does not
  render. READ IN CODE (`feature-pages.tsx:8`, `workflow.py:205-212`).
- **Langfuse export is an empty span per event**, only when keys are set; there is no flush on
  shutdown and no generation/usage object. `VALIDATION_REPORT.md` already states the adapter "does
  not export remote traces". READ IN CODE (`apps/api/app/observability/langfuse.py`).
- **No inference-mode disclosure.** `/api/v1/runtime` returns API version, Python version,
  executor and checkpoint only. READ IN CODE.
- **Version drift.** `package.json` and the lockfile pin `next@16.3.2`; ADR-009, the Architecture
  page ("Next.js 15") and `eslint-config-next@15.5.7` describe Next.js 15.5.7. READ IN CODE.
- **CI does not run the Makefile.** Backend CI type-checks four files only
  (`mypy app/domain.py app/routing app/services/cost.py app/api/schemas.py`) whereas
  `make typecheck` runs `mypy app`; the "Integration CI" job runs `tests/test_api.py
  tests/test_persistence.py` with fake inference, not `pytest -m integration`; the Security job
  reports `pip-audit` and `npm audit` with `|| true` (non-blocking). There is no browser test and
  no SSE/rejection check in CI. READ IN CODE (`.github/workflows/*.yml`).
- **Production deploy** runs `sudo -n /usr/local/sbin/deploy-sovereign-matrix <sha>` on a
  self-hosted runner; that script is not in the repository, so the production `.env`, inference
  mode and rollback behaviour cannot be read. The post-deploy smoke test **creates and approves a
  real execution on the public demo** every deploy. READ IN CODE
  (`.github/workflows/deploy-production.yml`).

## 3. Quality gates

`make` is absent, so each Makefile recipe line was run individually from the repository root with
the 3.13 virtual environment first on `PATH`. A first attempt that chained recipe lines inside one
wrapper masked a non-zero exit; the table below is from the per-command rerun.

| Makefile target | Command | Exit | Result | Label |
|---|---|---:|---|---|
| lint | `ruff check .` (api) | 0 | `All checks passed!` | VERIFIED |
| lint | `npm run lint` (web) | 0 | no findings | VERIFIED |
| typecheck | `mypy app` | 0 | `Success: no issues found in 24 source files` | VERIFIED |
| typecheck | `npm run typecheck` | 0 | clean | VERIFIED |
| test | `pytest` (api) | 0 | `33 passed, 10 warnings`; coverage 90.95% (gate 80%); 24 `ResourceWarning` lines (unclosed SQLite connections) | VERIFIED |
| test | `npm test` (web) | 0 | `Test Files 4 passed (4)`, `Tests 18 passed (18)` | VERIFIED |
| test-integration | `pytest -m integration --no-cov` | 0 | `14 passed, 19 deselected` | VERIFIED |
| build | `npm run build` | 0 | `Next.js 16.3.2 (Turbopack)`; 6 static routes + dynamic `/runs/[id]` | VERIFIED |
| compose-config | `docker compose --env-file .env.example config --quiet` | 0 | valid | VERIFIED |
| security | `pip-audit .` | 0 | `No known vulnerabilities found` (only after installing pip-audit; without it the recipe fails at its first line) | VERIFIED |
| security | `npm audit --audit-level=high` | **1** | 13 vulnerabilities: 1 moderate, 9 high, **3 critical** — `next 16.0.0–16.3.7` (incl. GHSA-2xp9-vwfh-vxw4 RCE in Image Optimization with AVIF, GHSA-cjq9-62q9-8jv4 SSRF in Image Optimization, two cache-poisoning advisories), `tinypool <=2.1.1` (dev, via vitest), `sharp <=0.35.5-rc.1` (high) | VERIFIED |
| security | `python3 scripts/scan-secrets.py` | 0 | `Secret scan passed (4 high-confidence rules)` | VERIFIED |

Conclusion: `make ci` equivalents pass; **`make security` fails** — today because of `npm audit`
(critical advisories against the deployed Next.js line), not only because `pip-audit` is missing.
The 2026-10-10 note ("fails because pip-audit is not installed") is true on a host without
pip-audit but hides the npm failure behind it.

## 4. Local execution

### 4a. API only, fake inference (port 8100, SQLite)

Started with `uvicorn app.main:app --port 8100`, `INFERENCE_MODE=fake`, `DEMO_STEP_DELAY_MS=150`,
`DATABASE_URL=sqlite:///<scratch>/fake.db`. All results VERIFIED.

| Check | Result |
|---|---|
| `/health/ready`, `/runtime` | `{"status":"ready"}`; runtime = `api_version 1.0.0, python 3.13.15, executor single-process-thread, checkpoint process-local-memory-with-fake-only-replay` — **no inference mode field** |
| `scripts/demo-smoke-test.sh http://127.0.0.1:8100` | exit 0, `Execution completed with audited HITL resume` |
| SAFE | QUEUED → COMPLETED; route FAST/`litellm`/`fast`; latency 25 ms; tokens 8/6; €0.0000048 |
| HIGH_RISK | → WAITING_APPROVAL; route **REASONING/`litellm`/`reasoning`** (maps to `openai/o4-mini` in LiteLLM); latency 25 ms |
| SENSITIVE | → WAITING_APPROVAL, sensitivity RESTRICTED; route SOVEREIGN/`ollama`/`sovereign`; €0 |
| PROVIDER_FAILURE | → FAILED, `ProviderUnavailableError: Provider ollama unavailable`; **execution shows `data_sensitivity: PUBLIC`** although the classifier set RESTRICTED (state not projected on failure); no `routing.selected` event and no routing audit for the denied route |
| TIMEOUT | → FAILED, `TimeoutError: Deterministic inference timeout` |
| MALFORMED_RESPONSE | → FAILED, `ValueError: Malformed inference response` |
| Every run | event sequences contiguous from 1 (25–45 events per run) |
| Approve | 200 → COMPLETED; duplicate approve → **409** |
| Reject | 200 → CANCELLED, result REJECTED; audit: `execution.created`, `routing.decision`, `approval.requested`, `approval.rejected (actor=assessor, reason=…)`, `workflow.completed` |
| `/observability/metrics` after 5 invocations | `latency_ms 125` = 5 × 25 ms; prompt tokens 40 = 5 × 8 words — constants, as read in code |
| SSE live stream (HIGH_RISK) | 43 events, sequences 1…43 strictly increasing; stream stays open at WAITING_APPROVAL |
| SSE reconnect with `Last-Event-ID` of event 20 | first replayed sequence 21, 23 events, 0 duplicates |
| SSE across approval | reconnected stream delivered `approval.approved`, `agent.started`, `agent.completed`, `agent.message`, `execution.completed`, then closed (curl exit 0) |
| Restart (SIGTERM) with two runs at WAITING_APPROVAL | after restart: approve → COMPLETED/APPROVED, reject → CANCELLED/REJECTED; 48 contiguous events, risk-analysis completed once (no duplicate telemetry) |
| SIGTERM during a running SAFE run | lifespan waits for the executor; run reaches COMPLETED before exit |
| **SIGKILL** during a running SAFE run | after restart the run stays `RUNNING` at `ingest_request` indefinitely (checked twice, 5 s apart). Known limitation (ADR-010), but nothing marks or recovers orphaned runs |

### 4b. Full Docker Compose stack — NOT VERIFIABLE on this host

Followed the README as a newcomer would: `cp .env.example .env`, generated every `change-me`
value (`LITELLM_MASTER_KEY` prefixed `sk-`; the password inside `DATABASE_URL` set equal to
`POSTGRES_PASSWORD`), added an untracked `docker-compose.override.yml` publishing the API on
`127.0.0.1:8010` instead of 8000. `docker compose config --quiet` passed.

| Step | Result | Label |
|---|---|---|
| `docker compose build` | exit 0 in 42 s (`sovereign-matrix-api`, `sovereign-matrix-web`) | VERIFIED |
| `docker compose up -d` | **exit 1**: `pull access denied for minio/minio, repository does not exist` | VERIFIED |
| `docker pull minio/minio:RELEASE.2025-07-23T15-54-02Z` | fails (also `:latest`; `quay.io/minio/minio` returns 401) — the pinned object-storage image is no longer publicly pullable | VERIFIED |
| `docker pull docker.langfuse.com/langfuse/langfuse-web:4` | fails (`repository does not exist`); `docker.langfuse.com/langfuse/langfuse-worker:4` and `langfuse/langfuse:4` pull | VERIFIED |
| postgres, redis, litellm v1.94.0, ollama 0.11.4, clickhouse 26.4, cloudflared | all pull | VERIFIED |
| `docker compose up -d web` (core services only) | containers created, postgres healthy, then **all project containers, the network and the volumes were destroyed ~23 s later by a process outside this session**; reproduced a second time | VERIFIED |
| Probe `docker run -d --name matrix-assessment-probe alpine:3 sleep 120` | removed between 40 s and 50 s after start | VERIFIED |
| Cause | the host runs an unattended OCOR verification loop (`/home/luca/.ocor-codex/ocor-loop2.sh`, verifier campaign under `/tmp/ocor-verify-…`) that recreates its own `ocor-*` stacks; containers outside that set do not survive. Not touched, per the session rules | VERIFIED (process list, Docker events) / cause of removal ASSUMPTION |

Consequence: the README quick start is **broken for any newcomer** (two unavailable images in
the default `docker compose up -d`), independently of this host. Whether the core stack (web, API,
PostgreSQL, LiteLLM, Ollama) starts and passes the smoke test under Compose could not be observed
here. Further README omissions found while preparing the stack:
- the `DATABASE_URL` password must equal `POSTGRES_PASSWORD`; "replace every change-me value with
  `openssl rand -hex 32`" produces two different values and a broken API (READ IN CODE);
- Langfuse shares the application's `matrix` database (`x-langfuse-env.DATABASE_URL`), so its
  Prisma migrations run in the application schema (READ IN CODE);
- `API_INTERNAL_URL` is read inside `next.config.ts` `rewrites()`, which Next.js evaluates at build
  time; the runtime environment variable in Compose has no effect (READ IN CODE; ASSUMPTION on
  Next.js behaviour, consistent with the local build used in 4d needing a rebuild);
- no Langfuse project or API keys are provisioned, so `LANGFUSE_PUBLIC_KEY/SECRET_KEY` stay empty
  and tracing is disabled unless the operator creates them by hand (READ IN CODE).

### 4c. Real inference: LiteLLM + Ollama (native processes, no Docker)

Because containers cannot survive on this host, the same versions were run natively from the
scratch directory: Ollama 0.11.4 (official release tarball) on `127.0.0.1:11500` with
`qwen2.5:1.5b-instruct-q4_K_M` (986 MB, pulled in 15 s), LiteLLM `1.94.0` (`litellm[proxy]` from
PyPI) on `127.0.0.1:4100` with the repository's `config/litellm/config.yaml` unchanged and an
empty `OPENAI_API_KEY`, and the API with `INFERENCE_MODE=litellm` on `127.0.0.1:8101` (SQLite).
No cloud key was used; no paid call was possible. All results VERIFIED.

| Check | Result |
|---|---|
| `POST /v1/chat/completions model=sovereign` via LiteLLM | 200 in 4.1 s, `usage: prompt 39, completion 3` |
| `model=reasoning` via LiteLLM | 500, `Missing credentials … No fallback model group found for original model_group=reasoning` |
| SENSITIVE | WAITING_APPROVAL, route SOVEREIGN/`ollama`; **latency 3267 ms, tokens 44/27 from the provider's `usage`**, cost €0 |
| Guided UI text ("…for sovereign deployment.") + HIGH_RISK | the word `sovereign` makes the keyword classifier return RESTRICTED, so the **UI's guided run routes to the local model**; two runs measured 3346 ms 47/32 and 2715 ms 47/32 tokens |
| Same, first attempt | **FAILED `ReadTimeout`**: Ollama answered in 31.05 s, over the API's hard-coded 30 s `httpx` timeout (no `max_tokens` is sent; CPU shared with the other project's test campaign) |
| SAFE, HIGH_RISK (smoke-script text), TIMEOUT, MALFORMED_RESPONSE | FAILED `Inference gateway unavailable: HTTPStatusError` — they route to cloud aliases (`fast`, `reasoning`) and no key is configured |
| PROVIDER_FAILURE | **COMPLETED** with a real Ollama call and **no approval** (RESTRICTED data, LOW criticality, model output did not contain the string `HIGH`). The fault-injection scenarios only exist in fake mode; in live mode their names are wrong |
| Approve / reject (live) | reject → CANCELLED/REJECTED with audit; approve path covered below |
| Restart with a run at WAITING_APPROVAL (live) | approve after restart → **FAILED `RuntimeError: Process-local checkpoint unavailable; live inference replay denied`**; audit shows `approval.approved (assessor, reason)` followed by `workflow.failed` — the audit records an approval that never took effect |
| Fail closed, `SOVEREIGN_AVAILABLE=false` | SENSITIVE → FAILED `Sovereign inference unavailable; cloud fallback denied`; **0 new LiteLLM log lines** (no call left the API) |
| Fail closed, Ollama stopped, flag true | SENSITIVE → FAILED `Inference gateway unavailable`; LiteLLM log shows only `model_group=sovereign`, `OllamaException`, `APIConnectionError` — no OpenAI attempt |
| Both fail-closed runs | execution shows **`data_sensitivity: PUBLIC`** and no `routing.selected` event — the UI cannot show *why* the run stopped |

## 5. Public demo (GET only)

`https://matrix.neuromorphicinference.com`, 2026-10-11 ~01:40 CEST. All VERIFIED with `curl`/
`urllib` GET requests; no execution was created, approved or rejected.

| Item | Result |
|---|---|
| Pages `/`, `/runs`, `/governance`, `/observability`, `/architecture` | 200; `server: cloudflare`; page shows `DEMO · SYNTHETIC DATA`; Architecture page says **"Next.js 15"** |
| `/api/v1/health/live`, `/health/ready` | 200 |
| Authentication | **none**: every GET succeeded without Cloudflare Access headers, so the README advice "place it behind Cloudflare Access" is not applied; mutating endpoints are therefore presumably public too (not tested: POST forbidden by the session rules) |
| `/api/v1/runtime` | `python 3.13.7` (matches the API image), executor single-process-thread, checkpoint process-local — **no inference mode** |
| `/control-plane/overview` | 31 executions: 17 COMPLETED, 13 WAITING_APPROVAL, 1 FAILED |
| Executions created | 2026-08-22 21:48 → **2026-08-28 17:13**; nothing in the 44 days since |
| WAITING_APPROVAL | 13 (12 HIGH_RISK + 1 SENSITIVE), created 22, 23, 24, 25 and 28 August, all with the UI's default request text — runs started from the browser and never decided |
| Audit (`/audit-events`) | 125 events; 16 `approval.approved` (13 by `demo-operator` = the CI smoke script, 3 by `operator` = the UI); **0 `approval.rejected`** ever |
| Invocations (`/observability/metrics` and per-run events) | 43 invocations, `latency_ms` **25 in 43/43**, `prompt_tokens` = word count of the request in **43/43**, summed latency 1075 ms = 43 × 25 → **every recorded model call is simulated**, while carrying `provider: ollama` (12) or `litellm` (31) |
| Demo pacing | latest run: 41 events in 0.37 s → `DEMO_STEP_DELAY_MS` is 0 in production; a visitor sees the whole graph arrive at once |
| Persistence engine | not exposed by any endpoint — PostgreSQL in production is NOT VERIFIABLE from outside |
| Deployed version | `gh run view 32776082221`: last successful *Production Deploy* 2026-08-24 20:49 UTC, `headSha 9345dda…` = HEAD, all three jobs green. Independent check: 6 of 8 public JS/CSS chunk files are byte-named identically to a local build of HEAD; the other two differ only in minifier identifiers, the inlined `NEXT_PUBLIC_API_URL` and one CSS utility. The API side matches HEAD's event contract (`agent.message`, 13 agents). Conclusion: HEAD is in service (VERIFIED for the workflow record; the bundle comparison is consistent with it) |
| Weekly *Security* workflow | green every Monday through 2026-10-05 although `npm audit` reports 3 critical advisories today — the job is non-blocking (`|| true`) |

### 4d. Real browser (headless Google Chrome via `playwright-core` 1.55.0, axe-core 4.10.2)

Web: production build of HEAD (`npm run build` with `API_INTERNAL_URL=http://127.0.0.1:8100`),
served first with `next start`, then with the container's entry point
`node .next/standalone/server.js` on `127.0.0.1:3000`. API: fake mode with
`DEMO_STEP_DELAY_MS=400` unless stated. Screenshots are in the session scratch directory
(`shots/`, 22 files); none is committed. All VERIFIED.

**Blocking defect — the guided scenario never reaches the approval dialog in a normal browser.**

| Check | Result |
|---|---|
| Guided HIGH_RISK run, default browser behaviour | UI shows `QUEUED`, connection `connected`, 0 theatre messages, no dialog at 2 s, 10 s and 30 s, while the backend reports **WAITING_APPROVAL** for the same run (`default-01-visitor-stuck.png`) |
| Root cause | the Next.js server compresses proxied responses. With `Accept-Encoding: gzip, deflate, br` (every browser) the `text/event-stream` proxied through `/api/v1/...` is gzip-buffered: **10 bytes in 6 s** through the standalone server versus **43 events** without compression. A stream that stays open (the run is waiting for a human) therefore delivers nothing; a stream that closes arrives all at once. The UI only reconciles state on SSE events, so it never learns the run is waiting |
| Same on the public demo (GET of an existing WAITING_APPROVAL run's stream) | `content-encoding: gzip`, **10 bytes in 10 s** with a browser-like header and **0 bytes in 12 s** even with `Accept-Encoding: identity` (Cloudflare requests compression from the origin). A COMPLETED run's stream returns all 45 events in 0.39 s once it closes |
| Inference | on the public demo a visitor who starts the guided scenario sees `QUEUED` indefinitely; this matches the 13 never-decided UI runs from August. Not reproduced end to end on the public site because POST is outside this session's rules (ASSUMPTION, strongly supported) |

To exercise the rest of the UI, the same browser run was repeated with the SSE request header
rewritten to `Accept-Encoding: identity` (Playwright route), i.e. what the fix would achieve:

| Check | Result |
|---|---|
| Guided run → approval dialog | dialog `Human decision required`, status WAITING_APPROVAL, 14 theatre messages; evidence = fake text `Risk HIGH. Production blast radius requires approval.` |
| Escape / re-entry | Escape closes the dialog; `Review approval` button appears and reopens it |
| Inspector (risk-analysis card) | shows model class, provider, model, placement, route rationale, fallback, policy, latency, tokens, cost |
| Approve with rationale | → COMPLETED |
| Reject | → CANCELLED |
| **Reload during a run** | before `RUNNING` → after **`STANDBY`**, no execution chip, URL `/` — the Command Centre loses the active run; there is no `?execution=` deep link |
| Deep links `/runs`, `/runs/{id}` ×3, `/governance`, `/observability`, `/architecture` | all 200 and render server data. Run Detail shows status, correlation ID, risk/sensitivity, node, evidence; **no route, tokens, latency, cost, event lineage, audit or operator reason**; **no approve/reject controls on Run Detail or Governance** (0 buttons) — a pending run opened from a link cannot be decided in the UI |
| Simulation disclosure | page text contains `synthetic` and `deterministic`, never `simulated`/`fake`; the inspector shows `Provider ollama · Latency 25 ms` for a simulated call |
| Keyboard | `Start guided demo` reached after 12 Tab presses; Enter starts the run; focus moves to the rationale textarea; Tab cycles Reject → Approve → Close → textarea (trap works); Enter on Approve → COMPLETED; primary button focus style `solid 2px` |
| Widths | no horizontal overflow at 390 px on `/`, `/runs`, `/architecture`. **`Start guided demo` button hidden below 1200 px** (`.context-panel{display:none}` at `max-width:1199px`); the header link `Start guided demo` is visible at 1024/1199 px but points to the hidden panel, and is itself hidden below 768 px. **The guided scenario cannot be started on a phone, a tablet or a laptop narrower than 1200 px** |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` rule present in `globals.css` (READ IN CODE); not visually assessed |
| axe-core | `/`: `landmark-complementary-is-top-level` (moderate), `landmark-unique` (moderate); `/runs`: **`aria-required-children` (critical, 9 nodes)**, `aria-allowed-role` (minor, 8); `/governance`, `/observability`, `/architecture`: none |
| Real local model in the browser (live API on 8100, Ollama warm) | dialog evidence = the model's raw output: **"I'm sorry, but I can't assist with that request. If you have any other questions…"** (the request is sent with no system prompt or task framing); inspector: SOVEREIGN · ollama · sovereign-local · **Latency 3524 ms · Tokens 79 · €0.00000**; policy label **`FAIL_CLOSED` on a call that succeeded**; approve → COMPLETED (`live-01-approval.png`, `live-02-inspector.png`) |
| Same, first call after Ollama start | backend FAILED `ReadTimeout` (Ollama took 31.7 s; API timeout 30 s) — second occurrence of 4c's failure |

### 4e. Observability (Langfuse)

Langfuse itself could not run (Docker removed by the host; `langfuse-web:4` and MinIO images
unavailable anyway). As a substitute, a local HTTP capture server stood in for `LANGFUSE_HOST` and
the API ran in fake mode with dummy keys (`pk-lf-assessment`/`sk-lf-assessment`).

| Check | Result | Label |
|---|---|---|
| One SAFE run, then graceful shutdown | **1 request**: `POST /api/public/otel/v1/traces`, 21 665 bytes, `application/x-protobuf` | VERIFIED |
| Content | one empty span per telemetry event (`with start_as_current_observation(...): pass`); no generation object, no model/usage/cost fields typed as such, no link between the OTel trace id and the execution's `trace_id` (a SHA-256 prefix computed separately) | READ IN CODE |
| Whether Langfuse accepts and displays it | NOT VERIFIABLE here | — |
| Production | `LANGFUSE_*` keys unknown; nothing observable from outside | NOT VERIFIABLE |

`VALIDATION_REPORT.md` says the adapter "does not export remote traces"; it does export spans
when keys are set, but nothing in the repository proves they are useful or arrive.

### Clean-up

All session processes (two APIs, LiteLLM, Ollama, Next.js, capture server) were stopped; ports
3000, 3901, 4100, 8100–8102 and 11500 are closed. No `sovereign-matrix` container, network or
volume exists (the host had already removed them). The locally built images
`sovereign-matrix-api` and `sovereign-matrix-web` and the pulled third-party images remain in the
Docker image store. `.env` and `docker-compose.override.yml` were deleted. No `ocor-*` container
was touched. The ignored `apps/api/.venv`, `apps/web/node_modules` and `apps/web/.next` remain.

## 6. Claims table

Status vocabulary: **TRUE AND DEMONSTRABLE** (true on the public demo and a visitor or reviewer
can see it), **TRUE LOCALLY ONLY**, **NOT TRUE TODAY**, **NOT VERIFIABLE**.

| # | Claim | Evidence | Status | Missing |
|---|---|---|---|---|
| C1 | A visitor drives the guided scenario to its final state from the browser on the public demo | §4d: UI stuck at QUEUED while backend waits (SSE gzip buffering), reproduced locally with the container's server and confirmed on the public stream (10 bytes/10 s); button hidden < 1200 px; 13 abandoned public runs | **NOT TRUE TODAY** | disable compression for SSE / bypass Next proxy for the stream; reconcile by polling; `?execution=` deep link; guided panel at all widths; browser E2E against the deployed URL |
| C2 | Sensitive requests go only to the local model; if absent the system stops | §4c: SOVEREIGN route to Ollama; flag off → FAILED with 0 LiteLLM calls; Ollama down → FAILED, LiteLLM log shows no OpenAI attempt; `tests/test_routing.py::test_sensitive_data_fails_closed` | **TRUE LOCALLY ONLY** | public demo runs fake inference, so routing there is to a simulated provider; failed runs show `PUBLIC` sensitivity and no route event, so the stop is not explained in the UI; "sensitive" is a keyword match (`restricted`, `pii`, `secret`, `sovereign`) |
| C3 | At least one step calls a real model through the routing layer, also on the public demo | §5: 43/43 public invocations have 25 ms latency and word-count tokens; §4c/4d: real Ollama call locally (3.3–3.5 s, provider usage tokens) | **NOT TRUE TODAY** (true locally) | run the public API with `INFERENCE_MODE=litellm` + Ollama (or a capped cloud alias); expose the mode; 30 s timeout and missing `max_tokens` cause cold-start failures; prompt has no task framing (model refuses) |
| C4 | High-risk runs stop until a person approves or rejects; both paths work from the browser | backend: approve/reject/409/restart verified (§4a); browser: both paths work only with compression bypassed (§4d); public: 0 rejections ever, 13 undecided | **NOT TRUE TODAY** (backend true; browser path broken in the shipped configuration) | same as C1; decision controls on Run Detail/Governance; live-mode restart turns pending runs into FAILED after recording `approval.approved` |
| C5 | Every decision is recorded immutably with actor and reason | audit rows for create/route/request/approve/reject/complete verified (§4a, §5); no update/delete path in `Repository` | **NOT TRUE TODAY** as worded | "immutable" is convention only (no DB constraint, trigger, privilege or hash chain); actor is a free string, always `operator` from the UI; empty reason replaced by a generated sentence; approval recorded before the resume outcome is known; fail-closed denials not audited as routing decisions |
| C6 | Latency, tokens and cost shown are measured values of the real call | locally in live mode: latency from `time.monotonic()`, tokens from provider `usage` (§4c); public: constants (§5); cost: 4-entry class table, SOVEREIGN = 0 | **NOT TRUE TODAY** (true locally for latency/tokens; cost is an estimate from a flat table) | real inference on the public demo; label fake values as simulated; per-model price table with source/date; say "estimated" |
| C7 | Running system uses Next.js, FastAPI, LangGraph, PostgreSQL (PostgreSQL also on the public demo) | Next.js 16.3.2, FastAPI, LangGraph 1.2.10 VERIFIED locally and in the public bundle/runtime; PostgreSQL: driver and Compose service present (READ IN CODE), **every test and every run in this session used SQLite**; public engine not exposed | **NOT VERIFIABLE** for PostgreSQL (rest TRUE AND DEMONSTRABLE) | expose the persistence dialect in `/runtime`; run CI integration tests against a PostgreSQL service container |
| C8 | Data are synthetic and the UI says so; what is simulated is marked as simulated | header `DEMO · SYNTHETIC DATA`; theatre messages tagged `SYNTHETIC`; but simulated inference is shown as `provider ollama`, `25 ms`, never as simulated; scenario cards say "deterministic", not "simulated" | **NOT TRUE TODAY** | runtime inference-mode field; `simulated` badge on invocations, metrics and inspector when fake |
| C9 | No repository, demo or site text presents it as a general multi-agent runtime, production system or certified system | none says "general multi-agent runtime" or "certified"; `CV_EVIDENCE.md` and the Architecture page exclude them explicitly. Risky wording: "agents"/"Agent conversation" for 9 no-op nodes and a fixed script, "PostgreSQL production persistence", "enterprise AI orchestration control plane" | **TRUE AND DEMONSTRABLE** (literal), with wording risks listed in §8 | rename no-op nodes as deterministic steps or describe them as such |

Additional claims found in `README.md`, `docs/showcase/` and the UI:

| # | Claim (source) | Status | Evidence / gap |
|---|---|---|---|
| A1 | "one real routed model invocation" (README) | NOT TRUE TODAY on the demo; TRUE LOCALLY ONLY | §4c vs §5 |
| A2 | "deterministic domain assessments, challenge analysis" (README) | NOT TRUE TODAY | the nine assessment/challenge nodes return only `current_node` |
| A3 | "Agent transitions record latency, tokens, estimated EUR cost, model class, and provider" (README) | NOT TRUE TODAY | only `risk-analysis` carries metrics (by design, `test_only_invoking_agent_has_model_and_cost_telemetry`) |
| A4 | "monotonic replayable SSE telemetry, heartbeats" (README); "ordered replayable telemetry" (CV_EVIDENCE) | TRUE LOCALLY ONLY | §4a correct at the API; broken through the Next.js proxy and Cloudflare for open streams (§4d) |
| A5 | "immutable audit events" (README) | NOT TRUE TODAY | see C5 |
| A6 | "PostgreSQL production persistence" (README) | NOT VERIFIABLE | see C7 |
| A7 | "LiteLLM gateway, compact Ollama inference, and failure-isolated Langfuse instrumentation" (README) | TRUE LOCALLY ONLY (LiteLLM/Ollama); Langfuse arrival NOT VERIFIABLE | §4c, §4e |
| A8 | Quick start `docker compose build && docker compose up -d` works (README) | NOT TRUE TODAY | `minio/minio` and `docker.langfuse.com/langfuse/langfuse-web:4` cannot be pulled |
| A9 | "place it behind Cloudflare Access for public use" / Cloudflare Access protection (README, CLOUDFLARE.md) | NOT TRUE TODAY on the demo | all GETs succeed unauthenticated (§5) — acceptable for a public demo only if the docs say so and mutations are bounded |
| A10 | Recruiter script step 4: Run Detail shows "event lineage, agent runs, route, decision result, correlation ID, trace ID, cost, and latency", "Use Replay" (`RECRUITER_DEMO_SCRIPT.md`) | NOT TRUE TODAY | Run Detail renders status/IDs/risk/evidence only; no Replay control exists |
| A11 | Recruiter script step 3: "Reject … remains CANCELLED after reload" | TRUE LOCALLY ONLY | Run Detail after reload shows Cancelled (§4d) |
| A12 | "Next.js 15" (Architecture page, ADR-009) | NOT TRUE TODAY | `next@16.3.2` in lockfile, build and public bundle |
| A13 | Cost model: per provider/model versioned prices, cached input, EUR conversion source, unknown pricing reported as unavailable (`COST_MODEL.md`) | NOT TRUE TODAY | `services/cost.py` |
| A14 | "Inspect … Human-in-the-Loop approvals in real time" (www.neuromorphicinference.com card) | NOT TRUE TODAY | §4d SSE buffering |
| A15 | SAFE / SENSITIVE / PROVIDER_FAILURE / TIMEOUT / MALFORMED_RESPONSE scenarios (README, UI) | TRUE LOCALLY ONLY in fake mode | in live mode PROVIDER_FAILURE completes, TIMEOUT/MALFORMED fail for unrelated reasons (§4c) |
| A16 | Release readiness 4–5/5 in every area (`RELEASE_READINESS.md`) | NOT TRUE TODAY | contradicted by A8, C1, C3, `npm audit` criticals |
| A17 | "Real LangGraph interruption and `Command(resume=…)`" (README) | TRUE AND DEMONSTRABLE (backend; visible once C1 is fixed) | `workflow.py`, §4a |
| A18 | "Hardened, non-root first-party containers" (README) | READ IN CODE only (`USER app`, `USER nextjs`, `cap_drop: ALL`) | not run here |

## 7. Defects and gaps

Severity: **D** = disproves a public claim, **M** = misleading, **Q** = quality defect. Effort: S
(< ½ day), M (½–2 days), L (> 2 days).

| ID | Sev | Defect | Evidence | Cause | Effort |
|---|---|---|---|---|---|
| D-01 | D | Browser never receives SSE events for a run that waits for approval; guided demo stuck at QUEUED | §4d, public stream test | VERIFIED: Next.js response compression of the proxied `text/event-stream` (and Cloudflare requesting compressed origin responses); UI reconciles only on events | S–M |
| D-02 | D | Public demo uses simulated inference while labelling it with real providers | §5: 43/43 at 25 ms, word-count tokens | VERIFIED: production `INFERENCE_MODE=fake` (inferred from data; `.env` not readable) | M (ops + code) |
| D-03 | D | No inference-mode / simulation disclosure in API or UI | `/runtime`, inspector | READ IN CODE | S |
| D-04 | D | Guided scenario cannot be started below 1200 px width | §4d widths | VERIFIED: `.context-panel{display:none}` | S |
| D-05 | D | Command Centre loses the active run on reload; no deep link to an active run | §4d reload | READ IN CODE: state only in `useReducer` | M |
| D-06 | D | Pending runs cannot be decided from Run Detail or Governance | §4d (0 buttons) | READ IN CODE | M |
| D-07 | D | "Immutable" audit is convention only; actor is a constant string; approval logged before outcome | §4a/4c, code | READ IN CODE | M |
| D-08 | D | README quick start fails: two images unpullable | §4b | VERIFIED | S–M |
| D-09 | D | PostgreSQL never exercised by tests or this session; not observable on the demo | §6 C7 | VERIFIED (conftest uses SQLite) | M |
| D-10 | D | Live mode: 30 s client timeout, no `max_tokens`; cold first call fails | §4c, §4d (31.05 s, 31.7 s) | VERIFIED | S |
| D-11 | D | Live mode: model receives the raw request with no task prompt and may refuse; refusal shown as "Policy evidence" | §4d live | VERIFIED | S |
| D-12 | M | Failed/fail-closed runs show `data_sensitivity: PUBLIC` and no route event/audit; the stop is unexplained | §4a, §4c | READ IN CODE: `_run` exception path does not project graph state | S |
| D-13 | M | `policy_outcome = FAIL_CLOSED` shown on every successful SOVEREIGN route | §4d live inspector | READ IN CODE (`executions.py`) | S |
| D-14 | M | Run Detail shows the system's `approval_reason` as "Operator rationale"; operator reason and audit not shown | code, §4d | READ IN CODE | S |
| D-15 | M | Fault scenarios are fake-only and misbehave in live mode | §4c | READ IN CODE | S |
| D-16 | M | Nine "agents" are no-op nodes; theatre text is a fixed table | code | READ IN CODE | S (wording) / L (implement — out of scope) |
| D-17 | M | Live-mode restart: pending approvals become FAILED; audit says approved | §4c | documented limitation; audit ordering is a defect | S (audit) / L (Postgres checkpointer) |
| D-18 | M | Docs drift: Next.js 15 vs 16.3.2, COST_MODEL, RELEASE_READINESS scores, VALIDATION_REPORT Langfuse statement, recruiter script step 4 | §6 | READ IN CODE | S |
| D-19 | M | Public API unauthenticated and mutating endpoints exposed; 13 stale pending runs from August visible to visitors | §5 | VERIFIED (GET); POST exposure ASSUMPTION | S (ops) |
| D-20 | Q | `npm audit`: 3 critical (Next.js 16.3.2 RCE/SSRF in image optimisation, tinypool), 9 high; weekly Security job green because non-blocking | §3 | VERIFIED | S–M |
| D-21 | Q | CI does not match the Makefile: partial mypy, integration job runs fake-only API tests not `-m integration`, no browser test, no SSE-through-proxy test | `.github/workflows` | READ IN CODE | M |
| D-22 | Q | SIGKILL leaves runs `RUNNING` forever; nothing marks them | §4a | VERIFIED | S |
| D-23 | Q | axe: `aria-required-children` critical on `/runs`; landmark issues on `/` | §4d | VERIFIED | S |
| D-24 | Q | `make` not documented as a prerequisite; `make setup` uses system Python (3.14 here) while CI/images use 3.13 | §1 | VERIFIED | S |
| D-25 | Q | Langfuse shares the application database; Langfuse keys not provisioned; spans are empty | §4b, §4e | READ IN CODE | M |
| D-26 | Q | `DEMO_STEP_DELAY_MS=0` in production: the 41-event run completes in 0.37 s, so "watch the agents work" is not visible | §5 | VERIFIED (timestamps) | S |
| D-27 | Q | `API_INTERNAL_URL` runtime variable ignored (rewrites fixed at build) | §4b | READ IN CODE / ASSUMPTION | S |
| D-28 | Q | 24 `ResourceWarning`s (unclosed SQLite connections) in pytest | §3 | VERIFIED | S |

## 8. Statements that say more than the system does

| Where | Text | Problem |
|---|---|---|
| www.neuromorphicinference.com, demo card | "Inspect governed agent execution, model routing, cost telemetry, and Human-in-the-Loop approvals in real time." | Approvals are not reachable in a browser today (D-01); model calls are simulated (D-02); "agent execution" is mostly no-op steps |
| README, Capabilities | "deterministic domain assessments, challenge analysis, and one real routed model invocation" | assessments/challenge are no-ops; the public invocation is simulated |
| README, Capabilities | "immutable audit events" | append-only by convention (D-07) |
| README, Capabilities | "PostgreSQL production persistence" | never exercised in tests; word "production" |
| README, Sovereign routing | "Agent transitions record latency, tokens, estimated EUR cost, model class, and provider" | only one node has them |
| README, Quick start | `docker compose up -d` | fails (D-08); also omits that the `DATABASE_URL` password must match |
| README, Security | "place it behind Cloudflare Access for public use" | not done on the public demo |
| README, Decision Theatre | "each visible agent-to-agent handoff is emitted and persisted by the backend event contract, carries evidence references" | true, but the messages are a fixed table, not produced by the agents; "evidence references" are constant labels |
| `RECRUITER_DEMO_SCRIPT.md` step 4 | Run Detail shows lineage, agent runs, route, cost, latency; "Use Replay" | not rendered; no Replay |
| `RECRUITER_DEMO_SCRIPT.md` step 1 | operational header shows "sovereign placement, cost budget" | header shows a static "EU policy boundary" and a running cost; no budget |
| `RELEASE_READINESS.md` | "All areas now meet the 4/5 showcase threshold"; HITL 5, Sovereign routing 5, FinOps 5 | contradicted by §4d, §5, §3 |
| `COST_MODEL.md` | versioned provider/model prices, cached input, EUR conversion source, unavailable pricing | not implemented |
| `VALIDATION_REPORT.md` | Langfuse adapter "does not export remote traces" | it exports empty spans (understated, but still wrong) |
| `ADR-009`, Architecture page | "Next.js 15.5.7" / "Next.js 15" | 16.3.2 is shipped |
| Architecture page, "Verified boundaries" | "Ordered SSE replay with correlation identifiers"; "Deterministic fake inference by default" | the first does not hold through the deployed proxy; the second is listed as a virtue while the page never says the *public* demo uses it |
| UI Command Centre | "Synthetic change assessment with sovereign routing, policy challenge and a real approval interrupt" | "policy challenge" is a no-op node; the interrupt is real but unreachable in the browser |
| UI inspector | `Policy FAIL_CLOSED` on a successful call; `Provider ollama · 25 ms` for a simulated call | D-13, D-03 |
| UI Run Detail | "Operator rationale: High-risk policy threshold reached" | system text labelled as the operator's (D-14) |
| Public CV/LinkedIn text | "live demo with synthetic data; one real routed model call" | the demo is live and synthetic; the real call is not on the demo today |
