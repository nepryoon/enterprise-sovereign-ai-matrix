# Local development

Requirements: Docker with Compose v2, Python 3.13, Node LTS and GNU Make.

```bash
cp .env.example .env            # replace change-me values
make setup
make ci
docker compose build
docker compose up -d
```

Mission Control is at `http://localhost:3000`, API docs at `http://localhost:8000/api/docs`, and Langfuse is loopback-only at `http://localhost:3001`. Pull the compact model once with `docker compose exec ollama ollama pull qwen2.5:1.5b-instruct-q4_K_M`. Tests never need it.
