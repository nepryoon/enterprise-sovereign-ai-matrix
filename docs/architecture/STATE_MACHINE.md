# State machine

```mermaid
stateDiagram-v2
 [*] --> QUEUED
 QUEUED --> RUNNING
 QUEUED --> CANCELLED
 RUNNING --> WAITING_APPROVAL: high risk / interrupt
 RUNNING --> COMPLETED: policy permits
 RUNNING --> FAILED
 RUNNING --> CANCELLED
 WAITING_APPROVAL --> RUNNING: approve / resume
 WAITING_APPROVAL --> FAILED: reject path
 WAITING_APPROVAL --> CANCELLED
```

The fixed graph is ingest → sensitivity classification → triage → risk analysis → policy evaluation → approval interrupt when required → finalise or reject. LLM output supplies evidence, never topology. Terminal states cannot transition. Approval is accepted only at `WAITING_APPROVAL`; LangGraph's checkpoint and command-resume primitive is the execution mechanism.
