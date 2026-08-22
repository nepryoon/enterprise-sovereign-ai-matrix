from __future__ import annotations

from queue import Empty
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.api.schemas import CreateExecutionRequest, DecisionRequest
from app.domain import ApprovalConflictError, ApprovalDecision

router = APIRouter(prefix="/api/v1")


def service(request: Request):
    return request.app.state.container.service


@router.post("/executions", status_code=201)
def create_execution(payload: CreateExecutionRequest, request: Request):
    return service(request).create(payload.request, payload.scenario)


@router.get("/executions/{execution_id}")
def get_execution(execution_id: UUID, request: Request):
    try:
        execution = service(request).require(execution_id)
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    return {**execution.model_dump(mode="json"),
            "audit": [a.model_dump(mode="json") for a in
                      request.app.state.container.repository.audits(execution_id)]}


@router.get("/executions/{execution_id}/events")
def get_events(execution_id: UUID, request: Request):
    try:
        service(request).require(execution_id)
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    return request.app.state.container.repository.events(execution_id)


def _decision(execution_id: UUID, payload: DecisionRequest, request: Request, approved: bool):
    try:
        return service(request).decide(execution_id, ApprovalDecision(
            execution_id=execution_id, approved=approved, actor=payload.actor,
            reason=payload.reason))
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
def stream(execution_id: UUID, request: Request,
           last_event_id: Annotated[str | None, Header(alias="Last-Event-ID")] = None):
    try:
        service(request).require(execution_id)
    except KeyError as exc:
        raise HTTPException(404, "Execution not found") from exc
    container = request.app.state.container

    def generate():
        for event in container.repository.events(execution_id, last_event_id):
            yield f"id: {event.event_id}\nevent: {event.event_type}\ndata: {event.model_dump_json()}\n\n"
            if event.event_type in {"execution.completed", "execution.failed"}:
                return
        queue = container.broker.subscribe(execution_id)
        try:
            while True:
                try:
                    event = queue.get(timeout=15)
                    yield (f"id: {event.event_id}\nevent: {event.event_type}\n"
                           f"data: {event.model_dump_json()}\n\n")
                    if event.event_type in {"execution.completed", "execution.failed"}:
                        return
                except Empty:
                    yield ": heartbeat\n\n"
        finally:
            container.broker.unsubscribe(execution_id, queue)

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/health/live")
def live():
    return {"status": "ok"}


@router.get("/health/ready")
def ready(request: Request):
    if not request.app.state.container.repository.health():
        raise HTTPException(503, "Persistence unavailable")
    return {"status": "ready"}
