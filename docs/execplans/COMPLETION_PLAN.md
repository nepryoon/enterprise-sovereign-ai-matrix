# Completion plan — make the public claim true and demonstrable

Date: 2026-10-11 (revision 2, same day: owner decisions recorded in §2; milestones reordered so
that M0 contains only SSE delivery, visible simulation, the Next.js security upgrade, the guided
button below 1200 px and the deploy). Baseline: HEAD `9345dda` (also the commit in service). Evidence for every
statement below is in [`docs/PROJECT_STATE_ASSESSMENT.md`](../PROJECT_STATE_ASSESSMENT.md)
(section numbers such as §4d and defect IDs such as D-01 refer to it).

Scope: complete what is already claimed. Out of scope and not planned: a general multi-agent
runtime, new agents or features, multi-tenancy/RBAC, Kubernetes, Terraform, regulatory
compliance statements, a UI redesign. `AGENTS.md` remains the working agreement; nothing here
replaces it.

Target public text (unchanged):

> Governed AI workflow: routes the model call by data-sovereignty rules, requires human approval
> and records every decision, with latency, token and cost tracking. Next.js, FastAPI, LangGraph,
> PostgreSQL. Status: proof of concept, live demo with synthetic data; one real routed model call;
> not a general multi-agent runtime.

## 1. Definition of Done (project level)

The project is done when all of the following hold at the same time, on `main`, for the commit
in service:

1. **Claims C1–C9 are TRUE AND DEMONSTRABLE on `https://matrix.neuromorphicinference.com`.**
   - C1 a visitor at any width from 390 px starts the guided scenario and reaches a terminal state;
   - C2 a sensitive request routes only to the local model; with the local model unavailable the run
     stops, and the UI shows the denied route and why;
   - C3 the guided run's model call is a real call through LiteLLM (`/api/v1/runtime` reports
     `inference_mode: "litellm"`; invocation events carry `simulated: false`);
   - C4 approve and reject both work from the browser, including after a page reload and from a
     deep link;
   - C5 every decision is an audit row with actor, reason and outcome; PostgreSQL rejects `UPDATE`
     and `DELETE` on the audit table;
   - C6 latency is measured around the provider call, tokens come from provider `usage`, cost is
     labelled an estimate and names its price source and date;
   - C7 `/api/v1/runtime` reports the persistence dialect `postgresql`; Next.js, FastAPI and
     LangGraph versions match the lockfiles;
   - C8 the UI states that data are synthetic and marks anything simulated as simulated;
   - C9 no text in the repository, the demo or the portfolio site describes a general multi-agent
     runtime, a production system or a certified system.
2. **A visitor verifies them in two minutes** by following `docs/showcase/RECRUITER_DEMO_SCRIPT.md`
   on the public demo; the script has been timed on the live site and every screenshot in
   `docs/showcase/screenshots/` was taken from the live site at the recorded commit.
3. **CI proves them on every pull request**: backend and frontend unit tests; backend integration
   tests against PostgreSQL; Playwright browser tests (guided approve, reject, reload, deep link,
   keyboard, 390 px, axe with no critical violation) against the production web server; an SSE
   test through the Next.js server with a browser `Accept-Encoding`; blocking dependency audit for
   high/critical advisories. A post-deploy smoke test covers approve, reject, SSE delivery through
   the public origin and `inference_mode`.
4. **Local start with one command** (`make up` or `./scripts/up.sh`) from a clean clone, with
   generated secrets, in fake or live mode, documented in the README and verified on a clean host.
5. **Deploy and rollback are documented** (`docs/operations/DEPLOYMENT.md`), rehearsed once, and
   the production `.env` contract (without values) is in the repository.

## 2. Decisions for the owner

| # | Decision | Options | Time / money | Risk | Recommendation |
|---|---|---|---|---|---|
| 1 | **Model for the real call on the public demo, and spend cap** | (a) local `qwen2.5:1.5b-instruct-q4_K_M` via Ollama on the VPS, guided scenario routed SOVEREIGN; (b) a small cloud model (e.g. the `fast` alias) behind LiteLLM with a hard budget; (c) both | (a) €0 API; needs ~2–2.5 GB free RAM on the VPS, 3–5 s warm latency on CPU, cold start ~30 s; (b) cents per day at demo volume, cap e.g. €5/month via LiteLLM budget + provider limit, needs a key and a spend alert; (c) sum | (a) VPS memory pressure, slow first call; (b) abuse of an unauthenticated public endpoint can burn budget up to the cap; key management | **(a)**. It matches the sovereignty story, costs nothing per call, and the local measurements (§4c) already show it works once the timeout and prompt are fixed. Keep cloud aliases configured but unused publicly |
| 2 | **If you prefer to keep the public demo simulated** | (a) keep fake, label it everywhere; (b) go live per decision 1 | (a) saves M4 (~3–4 days) and VPS RAM; (b) per plan | (a) C3 and C6 stay false on the demo | If (a), the truthful public text becomes: "…live demo with synthetic data and **simulated** model calls; one real routed model call **reproducible locally from the source**; not a general multi-agent runtime." Recommendation: go live (b) — the claim "one real routed model call" is the distinctive part |
| 3 | **Public access and demo hygiene** | (a) open demo with rate limits, a cap on concurrent runs, and a scheduled clean-up of stale pending runs; (b) Cloudflare Access in front (visitors must log in) | (a) ~½ day; (b) ~½ day + friction for every recruiter | (a) anyone can create/approve runs (acceptable for synthetic data if documented); (b) most recruiters will not log in | **(a)**, and change the README to say the demo is intentionally open with synthetic data |
| 4 | **Actor identity for decisions** | (a) the visitor types a display name, stored and shown as "self-declared"; (b) Cloudflare Access identity | (a) S; (b) M + needs decision 3(b) | (a) not an authenticated identity — must be worded so | **(a)**, worded "self-declared actor" in UI, audit and docs |
| 5 | **Langfuse** | (a) keep as an optional Compose profile, fix images, make no public claim; (b) make tracing work end to end and show it | (a) S inside T11; (b) M plus ~3 GB RAM for ClickHouse/Langfuse on the VPS | (b) memory on the VPS competing with Ollama | **(a)**. The public text does not mention Langfuse; README must say "optional, not part of the public demo" |

### Decisions taken by the owner (2026-10-11)

| # | Decision | Consequence for the plan |
|---|---|---|
| 1 | **(a) local Ollama model on the VPS, if the VPS resources suffice** | T14 starts with a resource check (free RAM ≥ 3 GB with the stack running, CPU, disk). If the check fails, the owner is asked again before M4; until then decision 2 stays (b). No cloud key in production. |
| 2 | **(b) go live** (follows from 1) | T12 and T14 stay in the minimal path. |
| 3 | **(a) open demo** with rate limit, active-run cap and stale-run clean-up | T03 as written. |
| 4 | **(a) self-declared actor** | The UI is in English, so the owner's term "auto-dichiarato" is rendered **"self-declared"** in the interface, in every audit row (`actor_kind: "self-declared"` next to the typed name) and in the docs. Applies to T06, T09, T15, T16. |
| 5 | **(a) Langfuse optional**, no public claim | T11 as written; T18 stays optional. |
| — | **M0 content** | Only T04 (Next.js security upgrade), T05 (SSE delivery), T07 (guided button below 1200 px), T01 (visible simulation) and T20 (M0 deploy). Everything else moves to later milestones. |

## 3. Milestones

After each milestone `main` passes CI and can be deployed. The label is the status line you can
truthfully use on CV/LinkedIn at that point.

| Milestone | Tasks | Outcome | Truthful status label at that point |
|---|---|---|---|
| **Today** (before M0) | — | public demo simulated, approval unreachable in browsers | "Proof of concept; source demonstrates sovereignty routing, human approval and audit with a real local-model call; public demo currently under repair." |
| **M0 — Demo usable and honest in the browser** | T04, T05, T07, T01, then T20 (deploy) | Next.js on a release without critical advisories; open SSE streams reach the browser through the production server; the guided scenario can be started at every width from 390 px; the header and inspector say when model calls are simulated; all of this deployed and checked on the public demo | "Proof of concept; live demo with synthetic data and **clearly labelled simulated model calls**; human approval and rejection in the browser; one real routed (local) model call reproducible from source; not a general multi-agent runtime." |
| **M1 — Browser path complete and wording true** | T02, T03, T06, T21, T08 | docs and UI wording match the code; stale public runs closable; reload, deep links and Run Detail decisions with a self-declared actor; accessibility fixes; Playwright in CI | M0 label (now backed by browser tests) |
| **M2 — Records are trustworthy** | T09, T10, T13 | append-only audit enforced by PostgreSQL; fail-closed stops visible and audited; PostgreSQL tested in CI and reported by `/runtime`; `pip-audit` blocking; cost labelled with price source | M0 label (now C5, C7 hold; C6 holds for the local run) |
| **M3 — Reproducible stack** | T11, T15 | `make up` works from a clean clone in fake and live mode; smoke covers approve, reject, SSE, mode | same label; reviewers can run it |
| **M4 — Real call in public** | T12, T14 | public demo runs `INFERENCE_MODE=litellm` with the local model; post-deploy smoke asserts it | **The full target text above.** |
| **M5 — Evidence** | T16 | README status, timed script, live screenshots, agent-risk page, CV evidence | full target text, with links a recruiter can check |
| Optional | T17, T18, T19 | orphan recovery, Langfuse end to end, demo pacing | unchanged |

## 4. Tasks

Conventions for every task: read `AGENTS.md` first and follow it; work on a branch named after
the task (`fix/T05-sse-delivery`); commit with a clear message; **do not push, merge or deploy**;
no paid model calls; add tests for each correctness change; update
`docs/design/REQUIREMENTS_TRACEABILITY.md` and the relevant limitation text. Effort: S ≤ ½ day,
M ½–2 days.

**Execution order**: T04 → T05 → T07 → T01 → T20 (M0); T02 → T03 → T06 → T21 → T08 (M1);
T10 → T09 → T13 (M2); T15 → T11 (M3); T12 → T14 (M4); T16 (M5). Tasks are listed below by ID,
not in execution order. T04 runs first because T05 must be verified on the Next.js release that
will ship: a framework upgrade after the SSE fix would invalidate its verification.

### T01 — Disclose the inference mode

- **Objective**: make simulation visible everywhere. **Answers**: C3, C6, C8; D-03.
- **Files**: `apps/api/app/api/routes.py`, `app/domain.py`, `app/agents/inference.py`,
  `app/services/executions.py`, `apps/web/types/index.ts`, `components/app-shell.tsx`,
  `components/features/decision-matrix.tsx`, `components/feature-pages.tsx`, tests.
- **Milestone**: M0. `persistence` on `/runtime` moved to T10 to keep M0 minimal.
- **Steps**: add `inference_mode` to `/runtime`; add
  `simulated: bool` to `ModelInvocation` and `TelemetryEvent` (true for
  `DeterministicFakeInference`); include `simulated_invocations` in `/observability/metrics`; in the
  UI fetch `/runtime` once in `AppShell` and show `SIMULATED MODEL CALLS` or `LIVE MODEL CALLS`
  next to `DEMO · SYNTHETIC DATA` (text, not colour only); show a `simulated` tag beside latency
  and tokens in the inspector, matrix card and Observability page.
- **Tests**: API test for `/runtime` fields in fake mode; test that fake invocation events carry
  `simulated: true` and that a stub live client yields `false`; Vitest for the badge and inspector
  tag.
- **Verify**: `ruff check . && mypy app && pytest` (api); `npm run lint && npm run typecheck && npm test && npm run build` (web).
- **Acceptance**: `curl /api/v1/runtime` shows `"inference_mode":"fake"` locally; the header
  reads `SIMULATED MODEL CALLS` in fake mode at 390 px and 1440 px.
- **Risks / rollback**: additive fields; revert the commit.
- **Depends on**: T04 (same framework baseline). **Effort**: S.

```text
Read AGENTS.md first and follow it. Task T01 in docs/execplans/COMPLETION_PLAN.md: the API and UI
never say when model calls are simulated (DeterministicFakeInference returns latency 25 ms and
word-count tokens while recording provider "ollama"/"litellm"). Make simulation explicit.
1) In apps/api: add `inference_mode` (settings.inference_mode) to GET /api/v1/runtime (the
   persistence field belongs to T10; do not add it here); add `simulated: bool = False` to
   ModelInvocation and TelemetryEvent in app/domain.py; set simulated=True in
   DeterministicFakeInference.invoke; propagate it on the risk-analysis agent.completed event in
   ExecutionService.observe_node; add `simulated_invocations` to /observability/metrics.
2) In apps/web: extend types; fetch /runtime once in AppShell and render a text badge
   "SIMULATED MODEL CALLS" or "LIVE MODEL CALLS" next to "DEMO · SYNTHETIC DATA" (visible at
   every width from 390 px); show a
   "simulated" tag next to latency/tokens in the task inspector, the matrix card and the
   Observability cards when simulated is true. Status must not be colour-only.
3) Tests: backend tests for the runtime fields and the simulated flag (fake true, a stub live
   client false); Vitest tests for the badge and inspector tag.
4) Run: cd apps/api && ruff check . && mypy app && pytest; cd apps/web && npm run lint &&
   npm run typecheck && npm test && npm run build. All must pass.
5) Update docs/design/REQUIREMENTS_TRACEABILITY.md. No paid calls, no push, no deploy. Work on
   branch fix/T01-inference-disclosure and commit.
Stop and report: files changed, test counts, command outputs, anything you could not do.
```

### T02 — Truthful wording pass

- **Objective**: remove every overstatement listed in assessment §8. **Answers**: C9, A2, A3, A5,
  A10, A12, A13, A16; D-14, D-16, D-18.
- **Files**: `README.md`, `docs/showcase/*.md`, `docs/RELEASE_READINESS.md`,
  `docs/finops/COST_MODEL.md`, `docs/VALIDATION_REPORT.md`, `docs/adr/ADR-009-*.md`,
  `apps/web/components/feature-pages.tsx`, `apps/web/components/mission-control.tsx`,
  `apps/web/app/layout.tsx`.
- **Steps**: rewrite claims to match code (the nine assessment/challenge nodes are deterministic
  placeholder steps, theatre messages are fixed synthetic narration, only `risk-analysis` invokes
  a model, audit is append-only by application convention until T09, cost is a flat class table
  until T13, Next.js 16.3.2); replace the README status with "proof of concept" and the M0 label;
  fix the recruiter script to what the UI shows; rescore `RELEASE_READINESS.md` from the
  assessment; fix Run Detail: label `approval_reason` as "Policy reason" and render the audit list
  (actor, reason, time); add a "Superseded by PROJECT_STATE_ASSESSMENT" note to the old
  validation statements that are now wrong.
- **Tests**: Vitest for Run Detail showing "Policy reason" and an audit row; no other code change.
- **Verify**: web lint/typecheck/test/build; `grep -RniE "immutable|Next.js 15|real routed" README.md docs apps/web` reviewed manually.
- **Acceptance**: every row of assessment §8 is either fixed or still true and marked as such in
  the traceability file.
- **Risks / rollback**: wording only; revert. **Depends on**: none (refresh after T01). **Effort**: S.

```text
Read AGENTS.md first and follow it. Task T02 in docs/execplans/COMPLETION_PLAN.md. Read
docs/PROJECT_STATE_ASSESSMENT.md sections 6–8: they list statements in README.md, docs/showcase/,
docs/RELEASE_READINESS.md, docs/finops/COST_MODEL.md, docs/VALIDATION_REPORT.md, ADR-009 and the
web UI that say more than the code does. Fix every one so it matches the code at HEAD:
- nine graph nodes (scope_architecture, threat_classification, cost_envelope,
  architecture_assessment, compliance_assessment, finops_assessment, resilience_assessment,
  challenge_analysis, ingest_request) are deterministic placeholder steps; say so;
- Decision Theatre messages are fixed synthetic narration from AGENT_BRIEFINGS; say so;
- only risk-analysis invokes a model; audit is append-only by application convention; cost is a
  four-rate class table ("poc-2026-08"); the shipped framework is Next.js 16.3.2 (Architecture
  page currently says "Next.js 15");
- README status: "Proof of concept; live demo with synthetic data and clearly labelled simulated
  model calls; one real routed (local) model call reproducible from source; not a general
  multi-agent runtime." Remove "PostgreSQL production persistence"; say PostgreSQL is the
  configured store and is not yet exercised by automated tests (T10 will change this).
- RECRUITER_DEMO_SCRIPT.md must describe only what the UI shows today (no Replay, Run Detail has
  no route/cost/latency yet).
- Rescore RELEASE_READINESS.md honestly from the assessment.
- In apps/web/components/feature-pages.tsx Run Detail: relabel `approval_reason` as "Policy
  reason" (it is set by the graph, not the operator) and render the execution's `audit` array
  (event type, actor, reason, timestamp). Add a Vitest test.
Do not invent capabilities, do not mention multi-tenancy, compliance, Kubernetes or Terraform
except as exclusions. British English. Run web lint/typecheck/test/build. Update
docs/design/REQUIREMENTS_TRACEABILITY.md. Branch fix/T02-truthful-wording; commit; no push/deploy.
Stop and report: a table of each changed statement (before → after, file), and command results.
```

### T03 — Public demo hygiene tooling

- **Objective**: give the owner an audited way to close stale pending runs and cap load.
  **Answers**: decision 3, D-19.
- **Files**: `apps/api/app/maintenance.py` (new CLI), `apps/api/app/config.py`,
  `apps/api/app/api/routes.py`, `docs/operations/DEPLOYMENT.md`, tests.
- **Steps**: CLI `python -m app.maintenance cancel-stale --older-than-hours 24 --reason ...`
  that cancels WAITING_APPROVAL runs through a domain method writing an `approval.expired` audit
  row (actor `maintenance`); add `MAX_ACTIVE_EXECUTIONS` (reject creation with 429 when
  exceeded); document running it on the host (owner action).
- **Tests**: stale run cancelled with audit row; fresh run untouched; 429 when cap reached.
- **Verify**: api lint/mypy/pytest. **Acceptance**: CLI dry-run lists candidates; real run audits.
- **Risks / rollback**: production use is an owner action; dry-run default. **Depends on**: none.
  **Effort**: S.

```text
Read AGENTS.md first and follow it. Task T03 in docs/execplans/COMPLETION_PLAN.md. The public demo
shows 13 executions stuck at WAITING_APPROVAL since August and its API is open. Add owner tooling,
without deploying anything:
1) apps/api/app/maintenance.py: a CLI (`python -m app.maintenance cancel-stale
   --older-than-hours N --reason TEXT [--apply]`, dry-run by default) that uses the repository
   from settings.database_url, finds WAITING_APPROVAL executions older than N hours, and for each
   (only with --apply) transitions to CANCELLED via validate_transition, appends an audit event
   `approval.expired` with actor "maintenance" and the reason, and emits a telemetry event so SSE
   clients terminate. Respect append-only semantics.
2) Settings MAX_ACTIVE_EXECUTIONS (default 20): POST /executions returns 429 with a clear detail
   when QUEUED+RUNNING+WAITING_APPROVAL exceeds it.
3) Tests for dry-run, apply, untouched fresh runs, and the 429 cap.
4) Document the owner procedure in docs/operations/DEPLOYMENT.md (exact docker compose exec
   command, dry-run first).
Run ruff, mypy app, pytest. Update REQUIREMENTS_TRACEABILITY.md. Branch fix/T03-demo-hygiene;
commit; no push/deploy. Stop and report.
```

### T04 — Close critical advisories and make the audit gate blocking

- **Objective**: remove the 3 critical / 9 high npm advisories (Next.js 16.3.2 image-optimisation
  RCE/SSRF, tinypool) from the public site and stop CI hiding them. **Answers**: D-20.
- **Files**: `apps/web/package.json`, `package-lock.json`, `next.config.ts` (set
  `images.unoptimized: true` if no image optimisation is used), `.github/workflows/security.yml`,
  `Makefile`, ADR-009.
- **Steps**: upgrade `next` and `eslint-config-next` to the lowest patched release (check
  `npm view next versions` and the advisories), `vitest` to a release with patched tinypool,
  `sharp` via Next; regenerate lockfile with `npm install`; make `npm audit --audit-level=high`
  blocking in `security.yml`; amend ADR-009. (Blocking `pip-audit` moved to T10 so M0 touches
  only the web dependencies.)
- **Milestone**: M0, first task.
- **Tests**: existing suites; build. **Verify**: `npm audit --audit-level=high` exit 0;
  lint/typecheck/test/build.
- **Acceptance**: `npm audit` reports no high/critical; Security workflow fails on a seeded
  vulnerable version (verify by reasoning about the exit code, not by committing one).
- **Risks / rollback**: framework upgrade may change lint/ESLint compatibility; revert lockfile.
  **Depends on**: none. **Effort**: S–M.

```text
Read AGENTS.md first and follow it. Task T04 in docs/execplans/COMPLETION_PLAN.md. `npm audit
--audit-level=high` in apps/web currently exits 1: 3 critical (next 16.0.0–16.3.7 incl.
GHSA-2xp9-vwfh-vxw4 and GHSA-cjq9-62q9-8jv4; tinypool <=2.1.1 via vitest 3.2.7) and 9 high
(sharp, braces, js-yaml, source-map-js, brace-expansion…). The weekly Security workflow stays
green because audits end with `|| true`.
1) Upgrade next (and eslint-config-next to the matching line), vitest and transitive packages to
   the lowest releases that clear high/critical advisories; regenerate package-lock.json with npm
   install; keep exact pins. If the app uses no next/image, set images.unoptimized: true.
2) Make the npm audit step in .github/workflows/security.yml blocking: `npm audit
   --audit-level=high` in apps/web must fail the job (remove its `|| true`); keep the JSON
   artefact. Do not change the pip-audit step (task T10 owns it).
3) Update ADR-009 (actual framework line and why) and the Architecture page version text
   (it currently says "Next.js 15").
4) Confirm the same-origin rewrite proxy still works after the upgrade: start the API in fake
   mode on a free port (port 8000 may be taken; check first), build with API_INTERNAL_URL
   pointing at it (the rewrites are fixed at build time), start
   `node .next/standalone/server.js` (copy .next/static and public into the standalone folder)
   on port 3000 (check that it is free first), and GET /api/v1/runtime and /api/v1/executions
   through port 3000. Do not try to fix SSE buffering here: that is T05. Record
   whether an open stream is still buffered with `Accept-Encoding: gzip`, as input for T05.
Run: npm ci, npm audit --audit-level=high, lint, typecheck, test, build. All must pass. Branch
fix/T04-advisories; commit; no push/deploy. Stop and report the before/after audit summary, the
exact versions chosen, any breaking change you had to absorb and the proxy/SSE observation.
```

### T05 — Deliver SSE through the production web server

- **Objective**: the browser must receive events of an open stream immediately. **Answers**: C1,
  C4, A4, A14; D-01.
- **Files**: `apps/web/next.config.ts`, possibly `apps/web/app/api/v1/executions/[id]/stream/route.ts`
  (streaming route handler that pipes the upstream body without compression),
  `apps/web/components/mission-control.tsx`, `apps/web/hooks/use-execution-stream.ts`,
  `apps/api/app/api/routes.py` (initial comment/heartbeat), `scripts/` test, CI.
- **Steps**: either set `compress: false` in `next.config.ts` (and rely on Cloudflare for static
  compression) or serve the stream through a dedicated route handler that sets
  `Content-Encoding: identity`, `Cache-Control: no-cache, no-transform` and streams; add
  `no-transform` on the API response too; send an immediate `: connected` comment and a heartbeat
  every 10 s; in the UI, reconcile with `GET /executions/{id}` on a 3 s interval while the run is
  non-terminal and the stream has delivered nothing for 5 s; show "connected" only after the first
  event or comment.
- **Tests**: an automated script `scripts/sse-through-web.sh` (or a Vitest/Node test) that starts
  the API (fake) and the standalone server, creates a HIGH_RISK run, opens the stream with
  `Accept-Encoding: gzip, deflate, br`, and asserts `approval.requested` arrives within 5 s; wire
  it into Integration CI. Unit test for the polling fallback.
- **Verify**: the script passes; reproduce assessment §4d: with gzip header, data arrives.
- **Acceptance**: `curl -N -H 'Accept-Encoding: gzip, deflate, br' http://127.0.0.1:3000/api/v1/executions/<waiting-id>/stream`
  prints `data:` lines within 2 s.
- **Risks / rollback**: disabling compression enlarges HTML/JS responses unless Cloudflare
  compresses them (it does by default); revert the config. Cloudflare must not buffer
  `text/event-stream` (owner check after deploy, part of T20). **Milestone**: M0. **Depends on**:
  T04 (verify on the Next.js release that will ship). **Effort**: M.

```text
Read AGENTS.md first and follow it. Task T05 in docs/execplans/COMPLETION_PLAN.md. Verified
defect (docs/PROJECT_STATE_ASSESSMENT.md §4d): the Next.js server compresses the proxied
`/api/v1/executions/{id}/stream` response when the client sends `Accept-Encoding: gzip` (every
browser). An open SSE stream (run waiting for approval) therefore delivers nothing (10 bytes in
6 s via `node .next/standalone/server.js`, versus 43 events without compression), so the UI stays
at QUEUED forever and never shows the approval dialog. The public demo behaves the same.
Fix it:
1) Make the stream reach the browser unbuffered through the production server: preferably a Next
   route handler for /api/v1/executions/[id]/stream that fetches API_INTERNAL_URL and returns the
   upstream body as a ReadableStream with Content-Type text/event-stream, Cache-Control
   "no-cache, no-transform", X-Accel-Buffering no, and no compression; or `compress: false` if the
   route handler cannot avoid compression. Add "no-transform" to the FastAPI stream response and
   emit an immediate ": connected" comment plus a heartbeat every 10 s.
2) In mission-control.tsx/use-execution-stream.ts: while the execution is non-terminal and no
   event or comment has arrived for 5 s, poll GET /executions/{id} every 3 s and reconcile; only
   report "connected" after the first byte.
3) Add scripts/sse-through-web.sh: builds nothing, assumes `npm run build` done; starts the API in
   fake mode on a free port and the standalone server pointed at it; creates a HIGH_RISK run;
   reads the stream with `curl -N -H 'Accept-Encoding: gzip, deflate, br' --compressed` and fails
   unless an `approval.requested` event arrives within 5 s; cleans up. Add it to
   .github/workflows/integration-ci.yml (with Node and Python set up).
4) Vitest for the polling fallback.
Run all web and api checks plus the new script. Update REQUIREMENTS_TRACEABILITY.md and
ADR-010 (delivery through the proxy). Branch fix/T05-sse-delivery; commit; no push/deploy.
Stop and report, including the script output.
```

### T06 — Resume and decide from any page

- **Objective**: reload and deep links keep the run; pending runs can be decided from Run Detail.
  **Answers**: C1, C4; D-05, D-06.
- **Files**: `apps/web/components/mission-control.tsx`, `components/feature-pages.tsx`,
  `components/approval-modal.tsx`, `lib/api.ts`, tests.
- **Steps**: Command Centre writes `?execution=<id>` with `router.replace` on start and reads it on
  mount (load execution + replay events); Run Detail subscribes to the stream while non-terminal,
  shows the route/latency/tokens/cost of the invoking step and the audit, and offers the same
  approval dialog for WAITING_APPROVAL; Governance rows link to Run Detail where the decision is
  possible; the dialog asks for a display name (decision 4) stored as `actor`, with
  `actor_kind: "self-declared"` on the audit row and the label "self-declared" wherever the actor
  is shown; an empty reason is sent as empty and shown as "no reason given" (backend keeps
  validation: change `reason` min length to 0 or require a reason — choose require, min 3 chars,
  and say so in the UI).
- **Tests**: Vitest for URL restore and for Run Detail decision controls; backend test if the
  reason rule changes.
- **Verify**: web checks; manual with the local stack.
- **Acceptance**: reload during RUNNING returns to the same run; a pending run opened via
  `/runs/<id>` can be approved and rejected.
- **Risks / rollback**: UI only; revert. **Depends on**: T05 (stream delivery). **Effort**: M.

```text
Read AGENTS.md first and follow it. Task T06 in docs/execplans/COMPLETION_PLAN.md. Verified in a
browser (assessment §4d): reloading the Command Centre during a run returns to STANDBY because the
active execution lives only in React state; Run Detail and Governance have no approve/reject
controls, so a pending run reached by link cannot be decided; the UI always sends actor
"operator" and replaces an empty reason with generated text.
1) Command Centre: on start, router.replace(`/?execution=${id}`); on mount, if the parameter is
   present, load GET /executions/{id} and its events (GET /executions/{id}/events) into the reducer,
   then subscribe to the stream. The reducer is idempotent by event_id; keep it that way.
2) Run Detail (/runs/[id]): subscribe while non-terminal; render the invoking step's model class,
   provider, latency, tokens, estimated cost and simulated flag from the events; render the audit
   list; show the ApprovalModal (or an inline panel) when WAITING_APPROVAL.
3) Approval dialog: add a required "Your name (self-declared)" field used as actor and require a
   reason of at least 3 characters (align DecisionRequest validation in apps/api/app/api/schemas.py
   and add a backend test). Store `actor_kind: "self-declared"` on the audit row (additive field,
   append-only semantics unchanged) and show the actor everywhere as "<name> (self-declared)".
   Never synthesise a reason.
4) Governance rows link to Run Detail and say "Decide".
5) Vitest tests for URL restore, Run Detail decision controls and the actor field.
Keyboard, reduced-motion and non-colour status rules from AGENTS.md apply. Run all checks.
Update REQUIREMENTS_TRACEABILITY.md. Branch fix/T06-resume-and-decide; commit; no push/deploy.
Stop and report.
```

### T07 — Guided scenario button at every width

- **Objective**: start the guided scenario on phone, tablet and narrow laptop. **Answers**: C1;
  D-04. (The accessibility fixes formerly in this task are T21, in M1.)
- **Files**: `apps/web/app/globals.css`, `components/mission-control.tsx`,
  `components/app-shell.tsx`.
- **Steps**: below 1200 px render the guided panel above the theatre (not `display:none`); make
  the header "Start guided demo" link visible and target the visible panel at all widths.
- **Tests**: Vitest for presence of the start button; Playwright assertions come with T08.
- **Verify**: web checks; a one-off headless browser check at 390, 1024 and 1199 px against the
  standalone server (screenshots in a temporary folder, not committed).
- **Acceptance**: button visible and operable by keyboard at 390, 1024, 1199 and 1440 px; no
  horizontal overflow at 390 px.
- **Risks / rollback**: layout only; revert. **Milestone**: M0. **Depends on**: T04. **Effort**: S.

```text
Read AGENTS.md first and follow it. Task T07 in docs/execplans/COMPLETION_PLAN.md. Verified
(assessment §4d): `.context-panel{display:none}` under max-width 1199px hides the only "Start
guided demo" button, so the guided scenario cannot be started on phones, tablets or laptops
narrower than 1200 px; the header link points to the hidden panel and is itself hidden under
768 px.
Fix without redesigning: show the guided panel stacked above the Decision Theatre below 1200 px,
keep the header link visible and pointing at it. Keep 44 px touch targets, keyboard operation,
reduced-motion behaviour and no horizontal overflow at 390 px. Do not touch the /runs table or
landmarks (task T21). Add a Vitest test that the start button renders. Run web checks, then check
390, 1024, 1199 and 1440 px in a headless browser against the standalone server and keep the
screenshots in a temporary folder. Update REQUIREMENTS_TRACEABILITY.md. Branch
fix/T07-responsive-guided-demo; commit; no push/deploy. Stop and report.
```

### T21 — Accessibility fixes found by axe

- **Objective**: clear the axe violations found in the assessment. **Answers**: D-23.
- **Files**: `components/feature-pages.tsx` (runs table roles), `components/app-shell.tsx`,
  `components/mission-control.tsx`.
- **Steps**: correct table semantics on `/runs` (`aria-required-children`, `aria-allowed-role`);
  fix `landmark-complementary-is-top-level` and `landmark-unique` on `/`.
- **Tests**: Vitest for table roles; axe assertions in T08.
- **Acceptance**: axe shows no critical/serious violations on `/`, `/runs`, `/governance`,
  `/observability`, `/architecture`.
- **Risks / rollback**: markup only; revert. **Milestone**: M1. **Depends on**: T07. **Effort**: S.

```text
Read AGENTS.md first and follow it. Task T21 in docs/execplans/COMPLETION_PLAN.md. axe-core
reports aria-required-children (critical, 9 nodes) and aria-allowed-role (minor) on /runs and
landmark-complementary-is-top-level / landmark-unique on / (assessment §4d). Use correct table
semantics (a real <table> or role=table/rowgroup/row/cell) on /runs and fix the landmarks without
redesigning. Add a Vitest test for the table roles; run axe-core in a headless browser on /,
/runs, /governance, /observability, /architecture and report the result. Run web checks. Update
REQUIREMENTS_TRACEABILITY.md. Branch fix/T21-a11y; commit; no push/deploy. Stop and report.
```

### T20 — M0 deploy and public verification (Claude prepares, owner executes)

- **Objective**: put T04, T05, T07 and T01 in service and prove them on the public demo.
  **Answers**: C1 (partly), C4 (dialog path), C8; D-01, D-03, D-04, D-20 in service.
- **Files**: `docs/operations/DEPLOYMENT.md` (M0 section), `docs/VALIDATION_REPORT.md`.
- **Steps**: Claude writes the M0 release checklist (branches to merge in order, expected commit,
  pre-deploy checks, Cloudflare check that `text/event-stream` under `/api/v1/*/stream` is not
  buffered or compressed, rollback = redeploy `9345dda` through the existing workflow); the
  owner merges, triggers *Production Deploy* and runs the checklist. After deploy, Claude runs
  read-only checks: `GET /api/v1/runtime` shows `inference_mode: "fake"`, the served HTML contains
  `SIMULATED MODEL CALLS`, the response headers show the new Next.js build, and a stream of an
  existing pending run delivers `data:` lines within 2 s with a browser `Accept-Encoding`. A
  browser check with one guided run (approve) and one reject at 390 px and 1440 px is done only
  with the owner's explicit authorisation to create runs on production.
- **Acceptance**: the four read-only checks pass and are recorded with date and SHA in
  `VALIDATION_REPORT.md`; if authorised, the guided approve and reject complete in a browser.
- **Risks / rollback**: deploy is an owner action (AGENTS.md); rollback to `9345dda`.
  **Milestone**: M0, last. **Depends on**: T04, T05, T07, T01. **Effort**: S (+ owner time).

```text
Read AGENTS.md first and follow it. Task T20 in docs/execplans/COMPLETION_PLAN.md. Do NOT merge,
push or deploy. T04, T05, T07 and T01 are committed on their branches. 1) Write the M0 section of
docs/operations/DEPLOYMENT.md: merge order, expected result per check, Cloudflare check that SSE
under /api/v1/*/stream is neither buffered nor compressed, rollback to 9345dda through the
existing Production Deploy workflow. 2) Stop and hand the checklist to the owner. 3) When the
owner says the deploy is done, run only GET requests against
https://matrix.neuromorphicinference.com: /api/v1/runtime (inference_mode "fake"), the home page
HTML (contains SIMULATED MODEL CALLS), and the stream of an existing WAITING_APPROVAL execution
with `curl -N --compressed -H 'Accept-Encoding: gzip, deflate, br' --max-time 5` (data: lines
within 2 s). Create runs or approve/reject only if the owner has authorised it in this session.
4) Record results, date and deployed SHA in docs/VALIDATION_REPORT.md. Branch docs/T20-m0-deploy;
commit; no push/deploy. Stop and report.
```

### T08 — Browser tests in CI

- **Objective**: prove C1/C4 and accessibility on every PR. **Answers**: DoD item 3.
- **Files**: `apps/web/e2e/*.spec.ts`, `apps/web/playwright.config.ts`, `apps/web/package.json`
  (devDependency `@playwright/test`, `@axe-core/playwright`), `.github/workflows/e2e.yml`,
  `scripts/e2e-stack.sh`.
- **Steps**: start API (fake, `DEMO_STEP_DELAY_MS=200`, SQLite or PostgreSQL service) and the
  standalone web server in CI; specs: guided approve; reject; reload mid-run resumes; deep link
  `/runs/<id>` decide; keyboard-only approve; 390 px start-to-dialog; axe no critical/serious;
  "SIMULATED MODEL CALLS" badge visible in fake mode; screenshots as artefacts. No compression
  workaround in tests — they must use the browser's default headers.
- **Verify**: `npx playwright test` locally and in the workflow.
- **Acceptance**: workflow green; failing any spec blocks merge.
- **Risks / rollback**: flakiness — use server state polling, not sleeps. **Depends on**: T05,
  T06, T07, T21, T01. **Effort**: M.

```text
Read AGENTS.md first and follow it. Task T08 in docs/execplans/COMPLETION_PLAN.md. There is no
browser test. Add Playwright (@playwright/test, @axe-core/playwright, exact pins, lockfile
updated) in apps/web/e2e with a config that targets a stack started by scripts/e2e-stack.sh: API
via uvicorn in fake mode with DEMO_STEP_DELAY_MS=200 on a free port, `npm run build` then
`node .next/standalone/server.js` (copy .next/static into the standalone folder) with
API_INTERNAL_URL pointing at the API. Specs (the axe fixes are done in T21), using default
browser headers (no
Accept-Encoding overrides):
- guided HIGH_RISK run reaches the approval dialog, approve with name and reason → COMPLETED;
- reject → CANCELLED, still CANCELLED after reload on /runs/<id>;
- reload during RUNNING returns to the same execution;
- open /runs/<id> of a waiting run and decide there;
- keyboard only: Tab to start, Enter, dialog focus trap, approve;
- 390x844 viewport: start the guided run and reach the dialog; no horizontal overflow;
- axe: no critical or serious violations on /, /runs, /governance, /observability, /architecture;
- header shows "SIMULATED MODEL CALLS" in fake mode.
Wait on server state (poll GET /api/v1/executions/{id}) rather than fixed sleeps. Add
.github/workflows/e2e.yml (ubuntu-latest, Node from .nvmrc, Python 3.13, npx playwright install
--with-deps chromium) that uploads screenshots and traces. Run the suite locally until green
three times in a row. Update REQUIREMENTS_TRACEABILITY.md and docs/testing/TEST_STRATEGY.md.
Branch fix/T08-playwright; commit; no push/deploy. Stop and report run times and any flake.
```

### T09 — Audit and routing records that hold

- **Objective**: make C5 true and fail-closed stops explainable. **Answers**: C2, C5; D-07, D-12,
  D-13, D-17.
- **Files**: `apps/api/app/persistence/database.py` (+ `migrations/` SQL), `services/executions.py`,
  `routing/policy.py`, `graph/workflow.py`, tests.
- **Steps**: on PostgreSQL create a trigger that raises on `UPDATE`/`DELETE` of `audit_events`
  (idempotent migration at start-up, documented); add `previous_hash`/`hash` (SHA-256 over the
  previous hash and the canonical payload) per execution and a `GET /executions/{id}/audit/verify`
  endpoint; record `approval.submitted` before resume and `approval.applied` or
  `approval.failed` after; on failure project the graph snapshot (sensitivity, criticality) onto
  the execution and emit a `routing.denied` event + audit when the policy or provider denies the
  SOVEREIGN route; set `policy_outcome` to `SOVEREIGN_ONLY` on success and `FAIL_CLOSED` only on
  denial.
- **Tests**: PostgreSQL test that `UPDATE`/`DELETE` fail (runs in T10's CI job; skip locally if no
  PostgreSQL); hash-chain verify detects tampering (SQLite); fail-closed run shows RESTRICTED and a
  `routing.denied` event; live-mode restart path writes `approval.failed`.
- **Verify**: api checks; T10 job.
- **Acceptance**: tampering detected; UI inspector shows "Denied — sovereign provider unavailable".
- **Risks / rollback**: trigger blocks maintenance edits by design; T03 uses inserts only.
  **Depends on**: T10 for the PostgreSQL job. **Effort**: M.

```text
Read AGENTS.md first and follow it. Task T09 in docs/execplans/COMPLETION_PLAN.md. Verified gaps
(assessment §4a, §4c, §6 C5): audit is append-only only by convention; the approval is audited as
`approval.approved` before the resume runs, so a live-mode resume that fails after a restart still
reads "approved"; a fail-closed or failed run keeps data_sensitivity PUBLIC and emits no routing
event, so the UI cannot explain the stop; every successful SOVEREIGN route is labelled
policy_outcome FAIL_CLOSED.
1) PostgreSQL: on start-up, idempotently create a trigger function that raises on UPDATE or
   DELETE of audit_events (skip on SQLite). Add per-execution hash chaining (previous_hash, hash =
   sha256(previous_hash + canonical JSON payload)) and GET /api/v1/executions/{id}/audit/verify
   returning {valid, broken_at}.
2) Approval: audit `approval.submitted` (actor, reason) before resume and `approval.applied` or
   `approval.failed` (error type) after; keep 409 semantics and the existing reject → CANCELLED
   path. Update the UI audit list labels.
3) Failure path in ExecutionService._run/decide: project the graph snapshot's sensitivity and
   criticality onto the execution; when RoutingPolicy or the provider denies SOVEREIGN, emit
   `routing.denied` (model_class SOVEREIGN, reason) and an audit row. Set policy_outcome to
   "SOVEREIGN_ONLY" for allowed sovereign routes and "FAIL_CLOSED" only for denials; show it in the
   inspector as text.
4) Tests: hash verification detects a tampered payload; fail-closed run (SOVEREIGN_AVAILABLE=false
   and fake PROVIDER_FAILURE) shows RESTRICTED and routing.denied; approval audit ordering; a
   PostgreSQL-only test (pytest marker `postgres`, skipped without TEST_DATABASE_URL) that UPDATE
   and DELETE on audit_events raise.
Run api and web checks. Update ADR-003, THREAT_MODEL.md and REQUIREMENTS_TRACEABILITY.md. Branch
fix/T09-audit-integrity; commit; no push/deploy. Stop and report.
```

### T10 — PostgreSQL in CI and in `/runtime`

- **Objective**: prove C7. **Answers**: C7, A6; D-09, D-21.
- **Files**: `apps/api/tests/conftest.py`, `.github/workflows/integration-ci.yml`,
  `backend-ci.yml`, `Makefile`.
- **Steps**: parametrise the `app` fixture with `TEST_DATABASE_URL`; in Integration CI add a
  `postgres:16.9-alpine` service and run `pytest -m "integration or postgres"` against it; make
  Backend CI run `mypy app` (as the Makefile does); make the Makefile and CI run the same commands;
  add `persistence` (SQLAlchemy dialect name) to `/runtime` (moved here from T01); add `pip-audit`
  to the api dev extra and make it blocking in `security.yml` (moved here from T04).
- **Verify**: workflow green; locally with a PostgreSQL if available.
- **Acceptance**: CI log shows the PostgreSQL-marked tests passing; `/runtime` reports
  `persistence: postgresql` in Compose.
- **Risks / rollback**: SQL differences surfaced by tests — that is the point. **Depends on**: T01.
  **Effort**: S–M.

```text
Read AGENTS.md first and follow it. Task T10 in docs/execplans/COMPLETION_PLAN.md. Every test uses
SQLite (apps/api/tests/conftest.py); PostgreSQL is never exercised. Backend CI type-checks four
files while `make typecheck` runs `mypy app`; Integration CI runs test_api.py/test_persistence.py
instead of the integration marker.
1) conftest: use TEST_DATABASE_URL when set (fresh schema per test session; truncate between
   tests), else SQLite.
2) .github/workflows/integration-ci.yml: add a postgres:16.9-alpine service with health check;
   run `pytest -m "integration or postgres" --no-cov` with TEST_DATABASE_URL set.
3) backend-ci.yml: run `mypy app`; keep coverage gate.
4) Makefile: add `test-postgres` and make `ci` match the workflows; document that GNU Make is
   required.
5) Add `persistence` (repository.engine.dialect.name) to GET /api/v1/runtime with a test.
6) Add pip-audit to the api dev extra and make the pip-audit step in security.yml blocking; run
   it and fix or document (with an expiry date) any finding.
Fix any PostgreSQL-specific failure in the code, not in the tests. If Docker or PostgreSQL is not
available locally, say so and rely on CI. Update REQUIREMENTS_TRACEABILITY.md. Branch
fix/T10-postgres-ci; commit; no push/deploy. Stop and report.
```

### T11 — One-command, reproducible Compose stack

- **Objective**: a stranger can start the stack. **Answers**: DoD item 4; A8; D-08, D-24, D-25,
  D-27.
- **Files**: `docker-compose.yml`, `docker-compose.live.yml` (new), `scripts/up.sh`,
  `scripts/gen-env.sh`, `Makefile`, `README.md`, `docs/operations/LOCAL_DEVELOPMENT.md`,
  `.github/workflows/docker.yml`.
- **Steps**: move Langfuse, ClickHouse, Redis and object storage behind an `observability` profile
  (not started by default); replace `minio/minio` with a pullable S3-compatible image pinned by
  digest and fix the Langfuse web image name (`langfuse/langfuse:<pinned>`), giving Langfuse its
  own database; `scripts/gen-env.sh` writes `.env` with consistent generated secrets (DATABASE_URL
  password = POSTGRES_PASSWORD, `sk-` LiteLLM key); `make up` = gen-env if missing + build + up +
  wait healthy + smoke; `make up-live` adds Ollama model pull and `INFERENCE_MODE=litellm`; make
  `API_INTERNAL_URL` a build argument; Docker CI job runs `make up` and the smoke test.
- **Tests**: Docker CI job (compose up, `/runtime` checks, smoke). **Verify**: `make up` on a clean
  clone. **Acceptance**: README quick start works verbatim on a clean host; CI job green.
- **Risks / rollback**: image substitutions; keep the old file in git history. **Depends on**: T15
  (smoke) ideally. **Effort**: M.

```text
Read AGENTS.md first and follow it. Task T11 in docs/execplans/COMPLETION_PLAN.md. Verified
(assessment §4b): `docker compose up -d` from the README fails because minio/minio cannot be
pulled and docker.langfuse.com/langfuse/langfuse-web:4 does not exist; the README's "replace every
change-me with openssl rand -hex 32" breaks DATABASE_URL; Langfuse shares the app database;
API_INTERNAL_URL is fixed at build time by next.config.ts rewrites.
1) Put langfuse-web, langfuse-worker, clickhouse, redis and the object store behind profile
   `observability`. Replace MinIO with a pullable S3-compatible image pinned by digest (verify
   with docker pull) and use the correct Langfuse web image pinned to an exact version; give
   Langfuse its own database (init script creating `langfuse`).
2) scripts/gen-env.sh: create .env from .env.example with consistent generated secrets (same
   password in POSTGRES_PASSWORD and DATABASE_URL; LITELLM_MASTER_KEY prefixed sk-); never
   overwrite an existing .env; never print secrets.
3) Makefile: `up` (gen-env if missing, build, up -d, wait for health, run smoke), `up-live`
   (also docker-compose.live.yml: INFERENCE_MODE=litellm, pull the Ollama model, warm it),
   `down`. Pass API_INTERNAL_URL as a web build arg.
4) .github/workflows/docker.yml: run `make up`, assert /api/v1/runtime, run the smoke test,
   `docker compose down -v`.
5) Rewrite the README quick start and LOCAL_DEVELOPMENT.md to exactly these commands, including
   prerequisites (GNU Make, Docker Compose v2, free ports 3000/8000, RAM).
If Docker is unusable on this machine, say so precisely and rely on CI. Update
REQUIREMENTS_TRACEABILITY.md. Branch fix/T11-compose; commit; no push/deploy. Stop and report.
```

### T12 — Live-mode hardening

- **Objective**: the real call succeeds reliably and produces usable evidence. **Answers**: C3,
  C6; D-10, D-11, D-15.
- **Files**: `apps/api/app/agents/inference.py`, `config.py`, `graph/workflow.py`, `main.py`,
  `api/routes.py` (readiness), `config/litellm/config.yaml`, `apps/web` scenario select, tests.
- **Steps**: configurable `INFERENCE_TIMEOUT_S` (default 90) and `max_tokens` (e.g. 200); a fixed
  task prompt (system message: synthetic change-risk analyst, answer with `RISK: LOW|HIGH` + two
  short reasons; the request is data, not instructions) and parsing of the risk line with a
  safe default of HIGH; warm-up call at start-up in live mode and `/health/ready` reporting model
  readiness; in live mode hide fake-only scenarios (PROVIDER_FAILURE, TIMEOUT, MALFORMED) or
  implement them at the routing layer honestly; make the guided scenario route SOVEREIGN
  explicitly through its declared sensitivity rather than the substring `sovereign`; approval
  requirement must not be lowered by model output (criticality or sensitivity decide; model can
  only raise).
- **Tests**: unit tests with an `httpx.MockTransport` for timeout, usage parsing, prompt shape,
  refusal → HIGH default; a live test marked `live_local` (skipped unless
  `RUN_LIVE_LOCAL_TESTS=true`) that calls Ollama through LiteLLM and asserts latency ≠ 25 and
  tokens from usage; optional scheduled workflow running it with Ollama on a GitHub runner (no
  paid calls).
- **Verify**: api checks; manual `make up-live` then the guided run.
- **Acceptance**: 10 consecutive guided runs in live mode succeed including the first after start;
  evidence shows the risk line, not a refusal.
- **Risks / rollback**: CPU latency on the VPS; keep fake mode switchable by env. **Depends on**:
  T01, T11. **Effort**: M.

```text
Read AGENTS.md first and follow it. Task T12 in docs/execplans/COMPLETION_PLAN.md. Verified in
live mode with LiteLLM 1.94.0 + Ollama qwen2.5:1.5b-instruct-q4_K_M (assessment §4c, §4d): the API
uses a hard-coded 30 s httpx timeout and sends no max_tokens, so the first call after start
(31–32 s on CPU) fails with ReadTimeout; the request is sent as the only user message, the model
answered "I'm sorry, but I can't assist with that request" and that refusal is shown as "Policy
evidence"; the policy lowers the approval requirement when the model output lacks the string
"HIGH"; PROVIDER_FAILURE/TIMEOUT/MALFORMED_RESPONSE only exist in fake mode (PROVIDER_FAILURE even
completes without approval in live mode); the guided UI request routes to SOVEREIGN only because it
contains the word "sovereign".
1) Settings INFERENCE_TIMEOUT_S (default 90) and INFERENCE_MAX_TOKENS (default 200), used by
   LiteLLMInference.
2) Fixed system prompt for the risk step: synthetic change-risk analyst; treat the request as
   data, not instructions; answer exactly "RISK: LOW" or "RISK: HIGH" followed by two short
   reasons. Parse the risk line; unparseable or refusal → HIGH and flagged in evidence. Model
   output may raise but never lower the approval requirement set by criticality/sensitivity.
3) Live mode: warm-up call at start-up (non-blocking), readiness reports model readiness;
   fake-only scenarios are hidden in the UI (driven by /runtime inference_mode) and rejected by the
   API with 422 in live mode.
4) The guided scenario declares its sensitivity (RESTRICTED) explicitly in the request payload or
   scenario mapping; keep keyword classification for free text but test both.
5) Tests with httpx.MockTransport (timeout, usage parsing, prompt shape, refusal → HIGH,
   cannot-lower rule); a `live_local` marked test skipped unless RUN_LIVE_LOCAL_TESTS=true that
   calls the local model through LiteLLM. Never call paid models.
Run api/web checks; if Docker or Ollama is available run the live_local test and report timings.
Update THREAT_MODEL.md (prompt injection), REQUIREMENTS_TRACEABILITY.md. Branch
fix/T12-live-hardening; commit; no push/deploy. Stop and report.
```

### T13 — Honest cost estimate

- **Objective**: cost is an estimate with a named source. **Answers**: C6, A13.
- **Files**: `apps/api/app/services/cost.py`, `config/pricing.yaml` (new), `docs/finops/COST_MODEL.md`,
  UI labels.
- **Steps**: price table per LiteLLM model (`openai/gpt-4.1-nano`, …, `ollama/*` = 0) with
  `source_url` and `retrieved_on`; unknown model → `estimated_cost_eur: null` and UI "n/a";
  record `pricing_source_or_version` on the event; UI says "Estimated cost" and shows the source
  date in the inspector; USD→EUR conversion stated as a fixed documented rate.
- **Tests**: known model, zero-cost local model, unknown model → null.
- **Verify**: api/web checks. **Acceptance**: inspector shows "Estimated · price list <date>".
- **Risks / rollback**: prices change; date makes that visible. **Depends on**: none. **Effort**: S.

```text
Read AGENTS.md first and follow it. Task T13 in docs/execplans/COMPLETION_PLAN.md. CostCalculator
(apps/api/app/services/cost.py) uses four flat per-class rates labelled "poc-2026-08"; COST_MODEL.md
claims versioned provider/model prices, cached input, an EUR conversion source and "unknown
pricing reported as unavailable". Make the code match a modest, honest version: config/pricing.yaml
keyed by the LiteLLM model string from config/litellm/config.yaml (ollama/* = 0), each with
input/output price per million tokens, currency, source_url and retrieved_on (do not invent prices:
if you cannot verify a price offline, mark the entry unknown); a documented fixed USD→EUR rate;
unknown → estimated_cost_eur null. Put pricing_source_or_version on the invocation event. UI:
"Estimated cost", "n/a" for null, price-list date in the inspector. Tests for known, zero and
unknown. Rewrite COST_MODEL.md to match. Run checks. Branch fix/T13-cost; commit; no push/deploy.
Stop and report.
```

### T14 — Live-mode production deploy (Claude prepares, owner executes)

- **Objective**: public demo runs the real local-model call; deploy and rollback documented.
  **Answers**: C3, C6, C7 on the demo; DoD item 5.
- **Files**: `docs/operations/DEPLOYMENT.md`, `docs/operations/PRODUCTION_ENV_CONTRACT.md` (names
  only), `.github/workflows/deploy-production.yml`, `scripts/post-deploy-check.sh`.
- **Steps**: document the production `.env` contract (`INFERENCE_MODE=litellm`,
  `DEMO_STEP_DELAY_MS`, `MAX_ACTIVE_EXECUTIONS`, no cloud keys), VPS resource check (free RAM ≥
  3 GB for Ollama), model pull/warm-up, Cloudflare check that `text/event-stream` is not
  buffered, rollback = redeploy previous SHA via workflow input + DB backup/restore steps; add a
  `sha` input to the deploy workflow for rollback; post-deploy check asserts `/runtime`
  (`inference_mode` = expected, `persistence` = postgresql) and runs the T15 smoke.
- **Tests**: shellcheck on scripts; dry run of the check against a local stack.
- **Verify**: owner runs the deploy and the check; record results in `VALIDATION_REPORT.md`.
- **Acceptance**: public `/runtime` shows `litellm` + `postgresql`; a guided run in a browser shows
  a non-simulated invocation; rollback rehearsed once.
- **Risks / rollback**: VPS memory; rollback by SHA. **Depends on**: T05, T06, T09–T13, T15, owner
  decisions 1 and 3. **Effort**: M (+ owner time).

```text
Read AGENTS.md first and follow it. Task T14 in docs/execplans/COMPLETION_PLAN.md. Do NOT deploy;
prepare everything the owner needs. The public demo currently runs simulated inference (43/43
invocations at 25 ms). The deploy workflow (.github/workflows/deploy-production.yml) calls
`sudo -n /usr/local/sbin/deploy-sovereign-matrix <sha>` on a self-hosted runner; that script is not
in the repository. Owner decision 1 is local Ollama on the VPS only if resources suffice: first
compare the VPS facts the owner supplied with the requirement (free RAM ≥ 3 GB with the stack
running); if they do not suffice or are missing, stop and report before writing anything else.
1) docs/operations/PRODUCTION_ENV_CONTRACT.md: every variable the production stack needs, purpose,
   example placeholder, no values; INFERENCE_MODE=litellm with the local model, no cloud keys.
2) docs/operations/DEPLOYMENT.md: pre-checks (free RAM ≥ 3 GB, disk), model pull and warm-up,
   Cloudflare check that /api/v1/*/stream is not buffered or cached (Cache Rule bypass), backup
   before deploy, deploy, post-deploy check, rollback to a previous SHA, restore; and a list of
   what the host script must do (owner to compare with /usr/local/sbin/deploy-sovereign-matrix).
3) Add a `sha` workflow_dispatch input (default github.sha) used for both deploy and rollback.
4) scripts/post-deploy-check.sh BASE_URL EXPECTED_MODE: asserts /api/v1/runtime inference_mode and
   persistence=postgresql, then runs scripts/demo-smoke-test.sh (approve, reject, SSE). Wire it into
   the smoke-production job.
Run shellcheck if available and dry-run the check against a local stack if one can run here.
Update REQUIREMENTS_TRACEABILITY.md. Branch fix/T14-live-deploy; commit; no push/deploy.
Stop and report what the owner must do, in order.
```

### T15 — Smoke test that covers the claims

- **Objective**: one script proves approve, reject, SSE and mode. **Answers**: DoD items 3–4.
- **Files**: `scripts/demo-smoke-test.sh`, `Makefile`.
- **Steps**: keep current approve path; add reject path; read the stream through the given base URL
  with `curl -N --compressed -H 'Accept-Encoding: gzip, deflate, br'` and require
  `approval.requested` within 10 s; print `/runtime`; optional `EXPECT_MODE`; use the T03 audit
  actor `smoke-test`; clean exit codes.
- **Tests**: run against the fake API locally. **Acceptance**: fails on today's `main` through
  the web server (proves it catches D-01), passes after T05.
- **Depends on**: T05 for green. **Effort**: S.

```text
Read AGENTS.md first and follow it. Task T15 in docs/execplans/COMPLETION_PLAN.md. Extend
scripts/demo-smoke-test.sh (keep its Cloudflare Access header support): after the existing
HIGH_RISK approve path, create a second HIGH_RISK run and reject it, asserting CANCELLED/REJECTED
and an approval.rejected audit row; create a third and read its stream through BASE_URL with
`curl -N --compressed -H 'Accept-Encoding: gzip, deflate, br'`, failing unless an
approval.requested event arrives within 10 s (then reject it so nothing stays pending); print
/api/v1/runtime and, if EXPECT_MODE is set, assert inference_mode equals it. Use actor
"smoke-test". Show that the SSE step fails against the web server on the pre-T05 code and passes
after T05 (or explain if T05 is not merged yet). Update Makefile `smoke` to accept BASE_URL.
Branch fix/T15-smoke; commit; no push/deploy. Stop and report.
```

### T16 — Evidence for reviewers

- **Objective**: a recruiter verifies the claims in two minutes. **Answers**: plan §7.
- **Files**: `README.md` (status section at the top), `docs/showcase/RECRUITER_DEMO_SCRIPT.md`,
  `docs/showcase/screenshots/`, `docs/showcase/AGENT_RISKS.md` (new), `docs/showcase/CV_EVIDENCE.md`,
  `docs/design/VISUAL_QA_REPORT.md`, `docs/VALIDATION_REPORT.md`.
- **Steps**: see §7 below. Screenshots taken with Playwright from the live site at the deployed
  SHA (GET plus one guided run per screenshot set, executed by the owner or with the owner's
  authorisation).
- **Acceptance**: every claim in README status links to a test, a file or a URL; the script was
  timed ≤ 2 minutes. **Depends on**: M4. **Effort**: M.

```text
Read AGENTS.md first and follow it. Task T16 in docs/execplans/COMPLETION_PLAN.md, section 7.
The public demo now runs the live configuration (confirm with GET /api/v1/runtime; if it does not,
stop and report). Produce reviewer evidence without changing product code:
1) README: a "Status" section at the top with the exact public text, the deployed SHA and date,
   and for each of C1–C9 one link to the test/file/URL that proves it.
2) docs/showcase/RECRUITER_DEMO_SCRIPT.md: a two-minute script matching the UI exactly; time it on
   the live site (one guided run, approve; a second, reject) only if the owner has authorised
   creating runs on production — otherwise write it and mark it "not yet timed".
3) Screenshots in docs/showcase/screenshots/ from the live site at 1440x900 and 390x844 (idle,
   running, approval dialog, inspector with live latency/tokens, completed, rejected, Run Detail,
   Architecture), with command, viewport, URL, SHA and date recorded in VISUAL_QA_REPORT.md.
4) docs/showcase/AGENT_RISKS.md: prompt injection, data exposure, unintended automation, when human
   review is mandatory — for each, the implemented control and the test that proves it (routing
   fail-closed tests, cannot-lower approval rule, request-as-data prompt, redaction, rate limit and
   active-run cap, audit hash chain/trigger), and the residual risk stated plainly.
5) Update CV_EVIDENCE.md and VALIDATION_REPORT.md with what was run and when.
British English, no praise, no claims beyond evidence. Branch docs/T16-evidence; commit; no
push/deploy. Stop and report.
```

### Optional tasks

| ID | Task | Answers | Effort | Prompt (summary; expand like the others) |
|---|---|---|---|---|
| T17 | Mark orphaned runs on start-up: QUEUED/RUNNING older than the process start become FAILED with `workflow.orphaned` audit | D-22 | S | "Read AGENTS.md. On application start, transition QUEUED/RUNNING executions not owned by this process to FAILED with audit `workflow.orphaned`; test with a repository seeded before create_app; update ADR-010. Branch fix/T17-orphans; commit; no push/deploy. Stop and report." |
| T18 | Langfuse end to end (observability profile): provision project/keys via `LANGFUSE_INIT_*`, export one trace per execution with a generation for the model call (model, usage, latency), flush on shutdown, test with a capture server | D-25, A7 | M | "Read AGENTS.md. Make the observability profile produce one Langfuse trace per execution with a generation for risk-analysis…; never export request text; test with a local capture server; no public claim. Stop and report." |
| T19 | Demo pacing in production (`DEMO_STEP_DELAY_MS` honoured in live mode for non-model steps) so visitors see the steps progress | D-26 | S | "Read AGENTS.md. Allow a bounded per-step delay for deterministic steps in live mode, default 0, documented in the env contract; test; stop and report." |

## 5. What the owner must do by hand

| When | Action | Why |
|---|---|---|
| Done (2026-10-11) | Decisions 1–5 (§2, "Decisions taken") | fixes T06, T12, T14 and wording |
| Before M0 deploy | Update the portfolio card and CV/LinkedIn to the "Today" label in §3 | the current card says "Human-in-the-Loop approvals in real time" |
| M0 (T20) | Merge the M0 branches in the order given by T20, trigger *Production Deploy*, run the T20 checklist; Cloudflare: confirm `/api/v1/*/stream` is neither cached, buffered nor compressed (Cache Rule bypass if needed) | deploy is an owner action (AGENTS.md); SSE must pass the edge |
| M0 (T20), optional | Authorise one guided approve and one reject on production for the browser check | the session rules forbid POST on production without it |
| After T03 | Run the stale-run clean-up on production (dry run, then apply) | 13 pending runs from August |
| After each later milestone | Authorise and trigger the *Production Deploy* workflow; then check the public site | deploy is an owner action (AGENTS.md) |
| Before M4 | Send VPS facts: CPU, total and free RAM with the stack running, disk, OS; whether PostgreSQL is the production `DATABASE_URL`; the current `INFERENCE_MODE`; the content (or a redacted summary) of `/usr/local/sbin/deploy-sovereign-matrix` | decision 1 is conditional on free RAM ≥ 3 GB; T14 is written against the real host script |
| M4 | Add production secrets on the host only (`LITELLM_MASTER_KEY`, database password); no cloud key | secrets never in the repository; decision 1(a) |
| M5 | Authorise creating a few runs on production for timing and screenshots | the session rules forbid POST on production without it |

## 6. Minimal path

Required to make C1–C9 true and demonstrable, in execution order: **M0** T04, T05, T07, T01, T20;
**M1** T02, T03, T06, T21, T08; **M2** T10, T09, T13; **M3** T15, T11; **M4** T12, T14; **M5** T16.

| Milestone | Task | Effort (days) |
|---|---|---:|
| M0 | T04 Next.js security upgrade | 1 |
| M0 | T05 SSE delivery | 1.5 |
| M0 | T07 guided button below 1200 px | 0.5 |
| M0 | T01 visible simulation | 0.5 |
| M0 | T20 M0 deploy and public check | 0.5 |
| **M0 subtotal** | | **4** |
| M1 | T02 wording | 0.5 |
| M1 | T03 demo hygiene | 0.5 |
| M1 | T06 resume and decide, self-declared actor | 1.5 |
| M1 | T21 accessibility | 0.5 |
| M1 | T08 Playwright in CI | 1.5 |
| M2 | T10 PostgreSQL in CI, `/runtime` persistence, blocking pip-audit | 1 |
| M2 | T09 audit integrity | 1.5 |
| M2 | T13 cost estimate | 0.5 |
| M3 | T15 smoke | 0.5 |
| M3 | T11 Compose | 1.5 |
| M4 | T12 live hardening | 1.5 |
| M4 | T14 live deploy | 1.5 |
| M5 | T16 evidence | 1.5 |
| **Total** | | **≈ 18 days** of Claude Code sessions with review, plus owner time for deploys and checks (≈ 1–2 days spread over the milestones) |

The total grew by one day against revision 1 because the deploy of M0 is now its own task (T20)
and the accessibility fixes are split from T07 into T21. If the VPS check before M4 fails and the
owner then keeps the demo simulated, T12 and T14 are dropped (−3 days) and the M0 label stays
permanent. Optional: T17, T18, T19 (≈ 2.5 days).

## 7. Reviewer evidence after everything works

1. **README status section** — first screen of the README: the public text verbatim, the deployed
   SHA and date, and one link per claim C1–C9 to the proving test, file or URL; the limitations
   (single-node executor, in-memory checkpoint, open demo, self-declared actor) in plain words.
2. **Two-minute demo script, verified** — `RECRUITER_DEMO_SCRIPT.md` timed on the live site:
   open demo → start guided run (local model, live latency/tokens visible) → approve with a
   reason → open Run Detail (route, latency, tokens, estimated cost, audit with hash check) →
   start a second run and reject → open Architecture/README status. Record the timing and date.
3. **Screenshots from the real demo** — taken by Playwright against the public URL at the deployed
   SHA, both 1440×900 and 390×844, listed in `VISUAL_QA_REPORT.md` with command and SHA. No
   locally rendered image presented as the live demo.
4. **Agent-risk page** (`docs/showcase/AGENT_RISKS.md`): prompt injection (request treated as
   data, fixed topology, model output cannot lower the approval requirement — tests), data
   exposure (sovereign-only routing, fail-closed tests, no request text in telemetry), unintended
   automation (no tools, fixed graph, human gate for high risk/sensitive — tests), when human
   review is mandatory (criteria in `policy_evaluation` and routing — tests), residual risks (open
   demo, self-declared actor, single node).
5. **`CV_EVIDENCE.md` updated** — the public text, the claim-to-evidence table, and the excluded
   claims list kept (no general multi-agent runtime, no production or certification claim).
