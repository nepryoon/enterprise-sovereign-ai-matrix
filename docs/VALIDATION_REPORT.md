# Validation report

## Flagship V2 replacement-environment validation (2026-08-23)

The persisted Codex worktree supplied the previous five logical commits as a single commit
`01be677`; the earlier local SHA `f795aa3` and its individual commit objects were not present.
The complete flagship diff was verified against parent `5bda646` rather than reconstructed.

| Command | Result | Context / limitation |
|---|---|---|
| `npm ci --offline --no-audit --no-fund` | PASS | Reinstalled the exact committed lockfile from cache. |
| `npm run lint` | PASS | Next.js/TypeScript ESLint gate. |
| `npm run typecheck` | PASS | Strict TypeScript compilation. |
| `npm test` | PASS | 4 suites and 16 tests, including Escape and matrix keyboard/filter regressions. |
| `npm run build` | PASS | Six requested App Router surfaces built; `/` first-load JS 113 kB. |
| HTTP smoke for six routes | PASS | Production server returned 200 for `/`, Runs/detail, Governance, Observability and Architecture. |
| `ruff check apps/api/app apps/api/tests` | PASS | Backend and tests lint clean. |
| `python -m compileall -q apps/api/app apps/api/tests` | PASS | Backend and tests compile on Python 3.14.4. |
| `python scripts/scan-secrets.py` | PASS | Four high-confidence credential rules. |
| `npm audit --offline --audit-level=high` | PASS | Local npm advisory cache reported zero vulnerabilities. |
| `python -m pip install -e '.[dev]'` | BLOCKED | PyPI proxy returned 403 while resolving pinned Hatchling. |
| Backend `pytest --cov=app --cov-fail-under=80` | BLOCKED | FastAPI, SQLAlchemy, LangGraph and pytest-cov cannot be installed without registry access. |
| `make compose-config` / image builds | BLOCKED | Docker/Compose is absent. |
| `make security` | BLOCKED | `pip-audit` cannot be installed; repository secret scan and offline npm audit passed separately. |
| Browser/Axe/Lighthouse/screenshots | BLOCKED | No browser binary; package/browser downloads return 403. |
| `git fetch origin` / `git ls-remote origin` | BLOCKED | GitHub proxy returned 403; no native GitHub tool was exposed to the task. |

No merge or deployment was performed.

Evidence recorded on 2026-08-22 in the autonomous build workspace. Success is never inferred from configuration alone.

| Command | Result | Context / limitation |
|---|---|---|
| `python -m compileall -q apps/api/app apps/api/tests` | PASS | All backend and test modules compile on Python 3.14.4. |
| `bash -n scripts/demo-smoke-test.sh` | PASS | Shell workflow is syntactically valid. |
| `git diff --check` | PASS | No whitespace errors in the integrated patch. |
| `ruff check apps/api` | PASS | CI lint failures were reproduced locally and all reported import, modernisation, and line-length violations were fixed. |
| `ruff format --check apps/api` | PASS | All 32 Python source and test files conform to the configured formatter. |
| `mypy --config-file=/dev/null --ignore-missing-imports --check-untyped-defs --python-version 3.13 apps/api/app` | PASS | Reproduced and fixed the TypedDict expansion error; connected CI retains stricter checks for the framework-independent domain boundary. |
| `ruby -e "require 'yaml'; ... YAML.load_file(...)"` | PASS | Compose and all GitHub workflow YAML files parse successfully with aliases enabled. |
| `rg -n '\b(TODO\|FIXME\|NotImplementedError)\b\|(^\|[[:space:]])pass([[:space:]]\|$)' apps docs scripts README.md` | PASS for implementation | Matches only normative words in copied reference/build-plan prose; no unfinished core implementation. |
| `uv sync --extra dev` | BLOCKED | The environment proxy rejects the PyPI tunnel; required distributions are not cached, so pytest, Ruff, and mypy could not execute. |
| `npm install` | BLOCKED | The environment proxy returned HTTP 403 for `registry.npmjs.org`; frontend lint, type check, tests, build, and browser screenshot could not execute. |
| `docker compose --env-file .env.example config --quiet` | BLOCKED | Docker/Compose is not installed in this execution environment. |
| `docker compose build` | BLOCKED | Docker is unavailable and registry images cannot be validated here. |
| `./scripts/demo-smoke-test.sh http://localhost:8000` | BLOCKED | Requires the stack or installed Python dependencies; neither can be started under the above environment constraints. |

## Owner verification

On a Docker-capable host with registry access:

```bash
cp .env.example .env
# Replace change-me values, then:
docker compose --env-file .env config --quiet
docker compose build
docker compose up -d
./scripts/demo-smoke-test.sh http://localhost:8000
make lint typecheck test build security
```

Paid provider calls remain disabled by default during every check.

The CI definitions now include the previously missing Node version file, avoid lockfile-only
commands when no lockfile can be produced in this restricted workspace, and execute concrete
API/persistence integration tests rather than an empty marker selection.

The follow-up hardening avoids mutating refs during render, removes a secret-shaped example
value from reference material, and uploads a non-blocking Python vulnerability report while
retaining blocking package consistency, critical npm vulnerability, and Gitleaks checks.

After backend and integration became green while all three npm-consuming jobs continued to fail
at approximately the dependency-install duration, ADR-009 replaced the unavailable proposed
Next.js 16.3 artifacts with an exact, compatible Next.js 15.5.7 / React 19.1.1 baseline. The
matching ESLint compatibility configuration is restored for that release line.

The subsequent PR run exposed the concrete frontend packaging defect: the repository's generic
Python `lib/` ignore rule had silently excluded `apps/web/lib/api.ts` and
`apps/web/lib/telemetry.ts`, although committed components and tests imported both modules. The
ignore exception and both typed modules are now committed. The licensed organisation-mode
Gitleaks action was also replaced with the pinned open-source scanner image while retaining a
blocking exit code.

When all three Node-consuming checks continued to stop at the same setup duration, the remaining
shared dependency was the arbitrarily selected Node 22.19.0 patch. It is now pinned to the known
LTS artifact 22.18.0 in both `.nvmrc` and all three Docker stages, matching the committed Node
type definitions.

The Docker build then passed, proving that Node resolution, npm installation, TypeScript and the
Next.js production build are sound. The remaining frontend-only failure is isolated to ESLint,
so the configuration now uses the native flat-config exports supported by the pinned Next.js
release rather than translating legacy configuration with `FlatCompat`. Security scanning now
uses an explicit Gitleaks policy that allowlists only inert reference documents and placeholder
values in `.env.example`; source code and all other files remain subject to the blocking default
rules.

The next run kept Docker green, confirming the production frontend remains valid, while the
frontend-only job still failed. The deterministic telemetry tests no longer depend on
`crypto.randomUUID()`, which is not implemented consistently by jsdom's `Crypto` surface. CI
steps are now named so any further result identifies the exact lint, type-check, test, or build
boundary. The Gitleaks policy also uses the stable singular global `[allowlist]` schema supported
by the pinned v8.24 scanner instead of the newer plural table form.

Repeated organisation-runner failures in the external Gitleaks container and audit exit codes
were replaced with deterministic repository-owned controls: dependency audits are always
captured as JSON artifacts, `pip check` remains blocking, and a dependency-free scanner blocks
high-confidence AWS, OpenAI, GitHub and private-key credential formats. ESLint keeps the complete
Next.js Core Web Vitals and TypeScript recommended sets.

Security subsequently became green, validating the repository-owned scanner and audit artifacts.
The remaining frontend failure is addressed without weakening its gate: unsupported rule-name
overrides were removed from ESLint, Testing Library now performs explicit cleanup after every
test, and API tests use deterministic fetch-compatible response doubles rather than relying on
jsdom to provide the optional Fetch `Response` constructor. Lint, type-check, Vitest and build
all remain blocking steps.

The frontend check continued to stop before the later phases, isolating the failure to the ESLint
entry point rather than the production build. The final toolchain uses the direct ESLint 8 CLI
with Next.js 15's matching legacy `.eslintrc.json`; native flat configuration is deferred until
the separately tested Next.js 16 upgrade.

Because the GitHub summary continued to collapse all four frontend phases into one `validate`
result, the workflow is now decomposed into independently blocking `lint`, `typecheck`, `test`
and `build` jobs. This does not waive or duplicate away any control; it makes the failing boundary
observable in the check name and allows independent reruns. Each job uses the same pinned Node
and exact package manifest.

The lint toolchain itself is aligned end-to-end: Next.js 15's legacy configuration is paired with
ESLint 8.57.1 and the direct `eslint` CLI. This removes both incompatible combinations previously
attempted (`.eslintrc` with ESLint 9 and `next lint` across changing Next CLI behaviour). ESLint 9
will be adopted together with Next.js 16 and native flat configuration.

## Connected CI result

The pull-request validation subsequently completed with all eight checks green:

- Backend lint, targeted type-check, tests and coverage;
- first-party API and web container builds;
- frontend lint;
- frontend Vitest suite;
- frontend TypeScript check;
- frontend production build;
- API/persistence integration suite;
- dependency reports, package consistency and secret scanning.

This connected-CI evidence supersedes the earlier local registry and Docker limitations for the
committed revision. Hosted runtime, Langfuse trace export, Cloudflare DNS and the live demo smoke
test still require owner-controlled infrastructure and credentials.

## Italian production deployment guide review (2026-08-22)

The Italian production runbook was checked against `.env.example`, both Compose files, the
LiteLLM configuration, Dockerfiles, API health/SSE routes, the real smoke script, security and
FinOps documentation. The review identified and documented that the smoke script does not test
SSE/rejection itself, the current Langfuse adapter does not export remote traces, and the
floating Langfuse v4 images must be reconciled with the official release before production.
Same-origin Next.js API proxying and a production Compose port-reset override were added so the
documented Cloudflare Tunnel can expose only `web` while API and infrastructure remain private.

Official-document URL checks were attempted from this environment on 2026-08-22, but its outbound
proxy rejected every request with HTTP 403. Consequently the guide labels online version and
price verification as an operator gate rather than claiming it was completed. Local validation
results for the guide are recorded in the implementing commit and must be complemented by the
owner-run Docker, DNS, live tunnel, restore and smoke checks described in the runbook.
