# Threat model

## Assets and boundaries
Execution requests, approvals, audit history, provider keys and restricted data cross browser, public web/API, internal gateway, inference and telemetry boundaries. Internal Compose services are not public.

## Threats and controls
- Secret leakage: environment-only secrets, ignored `.env`, redaction and secret scanning.
- Prompt injection/unsafe output: model text is untrusted evidence; deterministic policy owns transitions and no arbitrary tools execute.
- Approval bypass/replay: server validates waiting state and records actor/reason append-only; production must add organisational identity at the edge.
- IDOR: opaque UUIDs are insufficient authorisation; deployment must enforce Cloudflare Access and application tenancy before multi-tenant use.
- Sensitive telemetry: redact payloads and export metadata only for restricted work.
- Gateway exposure: LiteLLM/Ollama/data services live only on the internal network; keys are not browser-visible.
- Container compromise: non-root application images, dropped capabilities/no-new-privileges, no Docker socket.
- Availability: rate limits and health checks; sovereign outage fails closed. The in-memory graph
  checkpoint is not restart durable, so live-provider resume after process loss is denied.

Residual PoC risks are single-host failure, edge identity dependence and CPU inference latency. This showcase is not certified for regulated production workloads.
