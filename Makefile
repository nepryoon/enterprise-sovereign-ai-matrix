SHELL := /bin/bash
.PHONY: setup lint typecheck test test-integration build up down logs smoke security ci compose-config
setup:
	cd apps/api && python -m pip install -e '.[dev]'
	cd apps/web && npm install
lint:
	cd apps/api && ruff check .
	cd apps/web && npm run lint
typecheck:
	cd apps/api && mypy app
	cd apps/web && npm run typecheck
test:
	cd apps/api && pytest
	cd apps/web && npm test
test-integration:
	cd apps/api && pytest -m integration
build:
	cd apps/web && npm run build
compose-config:
	docker compose --env-file .env.example config --quiet
up:
	docker compose up -d
down:
	docker compose down
logs:
	docker compose logs -f api web
smoke:
	./scripts/demo-smoke-test.sh
security:
	cd apps/api && pip-audit
	cd apps/web && npm audit --audit-level=high
	python scripts/scan-secrets.py
ci: lint typecheck test build compose-config
