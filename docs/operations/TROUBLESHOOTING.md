# Troubleshooting

- `docker compose ps` and `docker compose logs --tail=200 SERVICE` expose health failures without dumping environment secrets.
- A waiting execution must be approved/rejected through its API; duplicate decisions correctly return conflict.
- A restricted execution failing while Ollama is unavailable is expected fail-closed behaviour. Restore Ollama and retry as a new execution.
- If SSE reconnects, the client replays persisted events. Confirm proxy buffering is disabled and `text/event-stream` is not cached.
- If the UI stays at `QUEUED` while the API reports a later status, check that the stream is not compressed: `curl -sN -D - -H 'Accept-Encoding: gzip, deflate, br' <origin>/api/v1/executions/<id>/stream` must print `content-encoding: identity` (or none) and `: connected` at once. `scripts/sse-through-web.sh` reproduces this check locally. The UI falls back to polling the execution every 3 s after 5 s of stream silence.
- Langfuse failure must not fail workflows. Restore its PostgreSQL/ClickHouse/Redis/MinIO dependencies, then verify new traces.
- Slow sovereign inference is expected on CPU; use the compact model and avoid concurrent model loads.
