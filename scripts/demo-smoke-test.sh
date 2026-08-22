#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://localhost:8000}"
payload='{"request":"HIGH_RISK: Rotate the production database encryption key and restart the cluster","scenario":"HIGH_RISK"}'

response="$(curl --fail --silent --show-error -H 'Content-Type: application/json' -d "$payload" "$base_url/api/v1/executions")"
execution_id="$(python -c 'import json,sys; print(json.load(sys.stdin)["execution_id"])' <<<"$response")"
echo "Created execution $execution_id"

for _ in $(seq 1 40); do
  response="$(curl --fail --silent --show-error "$base_url/api/v1/executions/$execution_id")"
  status="$(python -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$response")"
  [[ "$status" == "WAITING_APPROVAL" ]] && break
  [[ "$status" =~ ^(FAILED|CANCELLED|COMPLETED)$ ]] && { echo "Unexpected terminal state: $status" >&2; exit 1; }
  sleep 0.25
done
[[ "${status:-}" == "WAITING_APPROVAL" ]] || { echo "Approval checkpoint not reached" >&2; exit 1; }

curl --fail --silent --show-error -H 'Content-Type: application/json' \
  -d '{"actor":"demo-operator","reason":"Risk accepted for controlled demonstration"}' \
  "$base_url/api/v1/executions/$execution_id/approve" >/dev/null

for _ in $(seq 1 40); do
  response="$(curl --fail --silent --show-error "$base_url/api/v1/executions/$execution_id")"
  status="$(python -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$response")"
  [[ "$status" == "COMPLETED" ]] && { echo "Execution completed with audited HITL resume"; exit 0; }
  [[ "$status" =~ ^(FAILED|CANCELLED)$ ]] && { echo "Execution ended in $status" >&2; exit 1; }
  sleep 0.25
done
echo "Execution did not complete before timeout" >&2
exit 1
