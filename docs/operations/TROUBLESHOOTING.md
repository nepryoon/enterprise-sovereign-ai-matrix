# Troubleshooting

- `docker compose ps` and `docker compose logs --tail=200 SERVICE` expose health failures without dumping environment secrets.
- A waiting execution must be approved/rejected through its API; duplicate decisions correctly return conflict.
- A restricted execution failing while Ollama is unavailable is expected fail-closed behaviour. Restore Ollama and retry as a new execution.
- If SSE reconnects, the client replays persisted events. Confirm proxy buffering is disabled and `text/event-stream` is not cached.
- Langfuse failure must not fail workflows. Restore its PostgreSQL/ClickHouse/Redis/MinIO dependencies, then verify new traces.
- Slow sovereign inference is expected on CPU; use the compact model and avoid concurrent model loads.
