# Cloudflare presentation

## Direct subdomain
Create `matrix.neuromorphicinference.com` in a named Cloudflare Tunnel, route it only to `http://web:3000`, enable Cloudflare Access, then start `docker compose --profile tunnel up -d`. Store the token only in `.env` on the host.

## Embedded presentation
Prefer the direct subdomain. If embedding from `https://www.neuromorphicinference.com` is required, set CSP `frame-ancestors 'self' https://www.neuromorphicinference.com` at the web edge. Do not use `*` or disable frame protection globally. API, databases, Ollama, LiteLLM and Langfuse dependencies remain private.
