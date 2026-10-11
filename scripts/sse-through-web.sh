#!/usr/bin/env bash
# Prove that an open SSE stream reaches a browser-like client through the production web server.
#
# Builds nothing: run `npm run build` in apps/web first. Starts the API in fake mode and the
# standalone Next.js server (pointed at it at runtime), creates a HIGH_RISK run directly on the
# API, then reads its stream through the web server exactly as a browser would ask for it
# (`Accept-Encoding: gzip, deflate, br`). The run parks at WAITING_APPROVAL, so the stream stays
# open: a compressing proxy buffers it and nothing arrives. Fails unless `approval.requested`
# arrives within SSE_DEADLINE_SECONDS (default 5). No paid model is ever called.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
web_dir="$root/apps/web"
server="$web_dir/.next/standalone/server.js"
deadline="${SSE_DEADLINE_SECONDS:-5}"

if [[ -n "${PYTHON:-}" ]]; then
  python="$PYTHON"
elif [[ -x "$root/apps/api/.venv/bin/python" ]]; then
  python="$root/apps/api/.venv/bin/python"
else
  python="python3"
fi

[[ -f "$server" ]] || { echo "Missing $server: run 'npm run build' in apps/web first" >&2; exit 2; }

free_port() {
  "$python" -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'
}
port_in_use() {
  "$python" -c 'import socket, sys; s = socket.socket(); sys.exit(0 if s.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 1)' "$1"
}

api_port="${API_PORT:-$(free_port)}"
web_port="${WEB_PORT:-$(free_port)}"
for port in "$api_port" "$web_port"; do
  if port_in_use "$port"; then echo "Port $port is already in use" >&2; exit 2; fi
done

work="$(mktemp -d)"
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
  rm -rf "$work"
}
trap cleanup EXIT

wait_for() {
  local url="$1" name="$2" log="$3"
  for _ in $(seq 1 100); do
    curl --silent --fail --output /dev/null "$url" && return 0
    sleep 0.2
  done
  echo "$name did not become ready at $url; log follows" >&2
  cat "$log" >&2
  exit 1
}

(
  cd "$root/apps/api"
  exec env INFERENCE_MODE=fake DATABASE_URL="sqlite:///$work/sse.db" DEMO_STEP_DELAY_MS=100 \
    LANGFUSE_PUBLIC_KEY= LANGFUSE_SECRET_KEY= \
    "$python" -m uvicorn app.main:app --host 127.0.0.1 --port "$api_port" --no-access-log
) >"$work/api.log" 2>&1 &
pids+=("$!")

env PORT="$web_port" HOSTNAME=127.0.0.1 API_INTERNAL_URL="http://127.0.0.1:$api_port" \
  NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 node "$server" >"$work/web.log" 2>&1 &
pids+=("$!")

wait_for "http://127.0.0.1:$api_port/api/v1/health/live" "API" "$work/api.log"
wait_for "http://127.0.0.1:$web_port/" "Web server" "$work/web.log"
echo "API (fake) on :$api_port, standalone web server on :$web_port"

# Created on the API directly: build-time rewrites may point elsewhere, the stream route does not.
created="$(curl --silent --show-error --fail -H 'Content-Type: application/json' \
  -d '{"request":"HIGH_RISK: Rotate the production database encryption key and restart the cluster","scenario":"HIGH_RISK"}' \
  "http://127.0.0.1:$api_port/api/v1/executions")"
execution_id="$("$python" -c 'import json, sys; print(json.load(sys.stdin)["execution_id"])' <<<"$created")"
echo "Created HIGH_RISK execution $execution_id"

stream_url="http://127.0.0.1:$web_port/api/v1/executions/$execution_id/stream"
status=0
: >"$work/stream.txt"
curl --silent --show-error -N --compressed --max-time "$deadline" \
  -H 'Accept: text/event-stream' -H 'Accept-Encoding: gzip, deflate, br' \
  --dump-header "$work/headers.txt" --output "$work/stream.txt" "$stream_url" || status=$?
# 28 = --max-time reached: expected, the stream stays open while the run waits for a human.
if [[ "$status" -ne 0 && "$status" -ne 28 ]]; then
  echo "curl failed with exit code $status" >&2
  cat "$work/web.log" >&2
  exit 1
fi

echo "--- response headers"
tr -d '\r' <"$work/headers.txt"
echo "--- first ${deadline}s of the stream: $(wc -c <"$work/stream.txt") bytes, $(grep -c '^event: ' "$work/stream.txt" || true) events"
grep -E '^(: |event: )' "$work/stream.txt" || true

fail=0
if ! grep -qi '^content-type: text/event-stream' "$work/headers.txt"; then
  echo "FAIL: response is not text/event-stream" >&2; fail=1
fi
if grep -qiE '^content-encoding: *(gzip|br|deflate)' "$work/headers.txt"; then
  echo "FAIL: the web server compressed the event stream" >&2; fail=1
fi
if ! grep -q '^event: approval.requested' "$work/stream.txt"; then
  echo "FAIL: approval.requested did not arrive within ${deadline}s through the web server" >&2; fail=1
fi
backend="$(curl --silent --fail "http://127.0.0.1:$api_port/api/v1/executions/$execution_id" \
  | "$python" -c 'import json, sys; print(json.load(sys.stdin)["status"])')"
echo "Backend status: $backend"
[[ "$fail" -eq 0 ]] || exit 1
echo "PASS: approval.requested delivered through the web server within ${deadline}s"
