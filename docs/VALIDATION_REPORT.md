# Validation report

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
