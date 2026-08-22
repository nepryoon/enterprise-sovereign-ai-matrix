# VPS deployment

For the complete, operator-oriented Italian production runbook for
`matrix.neuromorphicinference.com`, including the production Compose override, Cloudflare,
backup, rollback, security and FinOps checks, see
[PRODUCTION_DEPLOYMENT_GUIDE_IT.md](PRODUCTION_DEPLOYMENT_GUIDE_IT.md).

Use an EU Linux VPS with Docker Compose v2. A practical full-stack baseline is 8 vCPU, 16 GB RAM and 80 GB SSD; 8 GB may work without Langfuse but leaves little headroom. CPU-only Ollama can be slow.

1. Clone, copy `.env.example` to `.env`, generate unique values (`openssl rand -hex 32`) and set `LANGFUSE_ENCRYPTION_KEY` to exactly 64 hex characters.
2. Run `docker compose config --quiet`, `docker compose build`, then `docker compose up -d`.
3. Pull the documented Ollama model and run `./scripts/demo-smoke-test.sh`.
4. Configure Cloudflare Access/Tunnel; never add public ports for internal services.
5. Back up the named PostgreSQL, ClickHouse and MinIO volumes; rehearse restore before production use.

Updates require database backup, image/change review, `docker compose pull`, application builds, migration, smoke test and rollback to prior immutable tags on failure.
