# Validation report

Evidence recorded on 2026-08-22 in the autonomous build workspace. Success is never inferred from configuration alone.

| Command | Result | Context / limitation |
|---|---|---|
| `python -m compileall -q apps/api/app apps/api/tests` | PASS | All backend and test modules compile on Python 3.14.4. |
| `bash -n scripts/demo-smoke-test.sh` | PASS | Shell workflow is syntactically valid. |
| `git diff --check` | PASS | No whitespace errors in the integrated patch. |
| `ruff check apps/api` | PASS | CI lint failures were reproduced locally and all reported import, modernisation, and line-length violations were fixed. |
| `ruff format --check apps/api` | PASS | All 32 Python source and test files conform to the configured formatter. |
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
