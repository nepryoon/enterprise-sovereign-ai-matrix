# Flagship case study: Sovereign Decision Control Plane

## Problem

Enterprise operators need to see why an AI-routed infrastructure decision was made, where data
was processed, which evidence informed it, what the invocation cost, and whether a human gate
changed the outcome.

## Implemented reference workflow

The repository implements a deterministic, synthetic change-risk workflow with sensitivity
classification, criticality triage, sovereign policy routing, model-backed risk analysis,
policy evaluation, a native LangGraph human interrupt, and distinct finalise/reject paths.
The flagship Decision Matrix projects that real contract into the phases Observe, Classify,
Analyse, Challenge, Govern, and Decide across enterprise disciplines.

## Engineering evidence

- FastAPI returns an execution identifier before process-local graph work completes.
- Persisted, ordered telemetry supports replay and reconnect without presenting replay as live.
- Routing and invocation metadata originate in backend decisions, not scenario controls.
- High-risk work pauses for a reasoned operator decision and resumes through the backend graph.
- Restricted work has no cloud fallback and fails closed when its sovereign provider is absent.

## Truthful boundary

This is a portfolio-grade reference workflow, not a general-purpose enterprise platform. It uses
a single-node in-process executor and an in-memory LangGraph checkpointer. PostgreSQL stores
application state, audit, and telemetry; arbitrary live-model graph checkpoints are not currently
restart durable. Authentication remains an edge responsibility for the showcase deployment.

