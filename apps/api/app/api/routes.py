from __future__ import annotations

import platform
from queue import Empty
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.api.schemas import CreateExecutionRequest, DecisionRequest
from app.domain import ApprovalConflictError, ApprovalDecision

router = APIRouter(prefix="/api/v1")


def service(request: Request):
    return request.app.state.container.service


@router.post("/executions", status_code=201)
def create_execution(payload: CreateExecutionRequest, request: Request, wait: bool = Query(False)):
    if wait:
        return service(request).create(payload.request, payload.scenario)
    return service(request).create_queued(payload.request, payload.scenario)


@router.get("/executions")
def list_executions(
    request: Request,
    status: str | None = None,
    scenario: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    items, total = request.app.state.container.repository.list_executions(
        status=status, scenario=scenario, offset=(page - 1) * page_size, limit=page_size
    )
    return {
        "items": [item.model_dump(mode="json") for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/control-plane/overview")
def overview(request: Request):
    items, total = request.app.state.container.repository.list_executions(limit=1000)
    counts: dict[str, int] = {}
    for item in items:
        counts[item.status.value] = counts.get(item.status.value, 0) + 1
    pending = [item for item in items if item.status.value == "WAITING_APPROVAL"]
    return {"total_executions": total, "status_counts": counts, "pending_approvals": len(pending)}


@router.get("/governance/approvals")
def pending_approvals(request: Request):
    items, total = request.app.state.container.repository.list_executions(
        status="WAITING_APPROVAL", limit=100
    )
    return {"items": [item.model_dump(mode="json") for item in items], "total": total}


@router.get("/executions/{execution_id}/routing")
def routing(execution_id: UUID, request: Request):
    try:
        service(request).require(execution_id)
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    events = request.app.state.container.repository.events(execution_id)
    return {
        "items": [
            event.model_dump(mode="json")
            for event in events
            if event.event_type == "routing.selected"
        ]
    }


@router.get("/observability/metrics")
def metrics(request: Request):
    executions, _ = request.app.state.container.repository.list_executions(limit=1000)
    invocations = []
    for execution in executions:
        invocations.extend(
            event
            for event in request.app.state.container.repository.events(execution.execution_id)
            if event.event_type == "agent.completed" and event.prompt_tokens is not None
        )
    return {
        "invocation_count": len(invocations),
        "prompt_tokens": sum(event.prompt_tokens or 0 for event in invocations),
        "completion_tokens": sum(event.completion_tokens or 0 for event in invocations),
        "estimated_cost_eur": round(sum(event.estimated_cost_eur or 0 for event in invocations), 8),
        "latency_ms": sum(event.latency_ms or 0 for event in invocations),
    }


@router.get("/audit-events")
def audit_events(request: Request, event_type: str | None = None):
    executions, _ = request.app.state.container.repository.list_executions(limit=1000)
    items = [
        audit
        for execution in executions
        for audit in request.app.state.container.repository.audits(execution.execution_id)
        if not event_type or audit.event_type == event_type
    ]
    items.sort(key=lambda item: item.timestamp, reverse=True)
    return {"items": [item.model_dump(mode="json") for item in items], "total": len(items)}


@router.get("/workflow-definition")
def workflow_definition():
    nodes = [
        "ingest_request",
        "scope_architecture",
        "classify_sensitivity",
        "threat_classification",
        "cost_envelope",
        "triage",
        "architecture_assessment",
        "risk_analysis",
        "compliance_assessment",
        "finops_assessment",
        "resilience_assessment",
        "challenge_analysis",
        "policy_evaluation",
        "approval_interrupt",
        "finalise",
        "reject",
    ]
    return {"nodes": nodes, "execution_mode": "deterministic-sequential"}


@router.get("/runtime")
def runtime(request: Request):
    return {
        "api_version": request.app.version,
        "python": platform.python_version(),
        "executor": "single-process-thread",
        "checkpoint": "process-local-memory-with-fake-only-replay",
    }


@router.get("/executions/{execution_id}/agent-runs")
def agent_runs(execution_id: UUID, request: Request):
    try:
        service(request).require(execution_id)
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    events = request.app.state.container.repository.events(execution_id)
    return {
        "items": [
            event.model_dump(mode="json")
            for event in events
            if event.event_type.startswith("agent.")
        ]
    }


@router.get("/executions/{execution_id}")
def get_execution(execution_id: UUID, request: Request):
    try:
        execution = service(request).require(execution_id)
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    return {
        **execution.model_dump(mode="json"),
        "audit": [
            a.model_dump(mode="json")
            for a in request.app.state.container.repository.audits(execution_id)
        ],
    }


@router.get("/executions/{execution_id}/events")
def get_events(execution_id: UUID, request: Request):
    try:
        service(request).require(execution_id)
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    return request.app.state.container.repository.events(execution_id)


def _decision(execution_id: UUID, payload: DecisionRequest, request: Request, approved: bool):
    try:
        return service(request).decide(
            execution_id,
            ApprovalDecision(
                execution_id=execution_id,
                approved=approved,
                actor=payload.actor,
                reason=payload.reason,
            ),
        )
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    except ApprovalConflictError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.post("/executions/{execution_id}/approve")
def approve(execution_id: UUID, payload: DecisionRequest, request: Request):
    return _decision(execution_id, payload, request, True)


@router.post("/executions/{execution_id}/reject")
def reject(execution_id: UUID, payload: DecisionRequest, request: Request):
    return _decision(execution_id, payload, request, False)


@router.get("/executions/{execution_id}/stream")
def stream(
    execution_id: UUID,
    request: Request,
    last_event_id: Annotated[str | None, Header(alias="Last-Event-ID")] = None,
):
    try:
        service(request).require(execution_id)
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    container = request.app.state.container

    def generate():
        # Subscribe before catch-up. Events published during the history query are
        # present both in persistence and the queue and are removed by sequence dedupe.
        queue = container.broker.subscribe(execution_id)
        seen: set[int] = set()
        try:
            for event in container.repository.events(execution_id, last_event_id):
                seen.add(event.sequence)
                yield _sse(event)
                if event.event_type in {"execution.completed", "execution.failed"}:
                    return
            while True:
                try:
                    event = queue.get(timeout=15)
                    if event.sequence in seen:
                        continue
                    seen.add(event.sequence)
                    yield _sse(event)
                    if event.event_type in {"execution.completed", "execution.failed"}:
                        return
                except Empty:
                    yield ": heartbeat\n\n"
        finally:
            container.broker.unsubscribe(execution_id, queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(event):
    return f"id: {event.event_id}\nevent: {event.event_type}\ndata: {event.model_dump_json()}\n\n"


@router.get("/health/live")
def live():
    return {"status": "ok"}


@router.get("/health/ready")
def ready(request: Request):
    if not request.app.state.container.repository.health():
        raise HTTPException(503, "Persistence unavailable")
    return {"status": "ready"}
