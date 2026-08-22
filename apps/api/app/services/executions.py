from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.domain import (
    ApprovalConflictError,
    ApprovalDecision,
    AuditEvent,
    DataSensitivity,
    Execution,
    ExecutionStatus,
    ModelInvocation,
    ModelClass,
    RiskLevel,
    TelemetryEvent,
    validate_transition,
)
from app.graph.workflow import WorkflowEngine, WorkflowState
from app.observability.langfuse import TraceAdapter
from app.persistence.database import Repository
from app.services.cost import CostCalculator
from app.telemetry.broker import EventBroker


class ExecutionService:
    def __init__(self, repository: Repository, broker: EventBroker, engine: WorkflowEngine,
                 traces: TraceAdapter) -> None:
        self.repository, self.broker, self.engine, self.traces = repository, broker, engine, traces
        self.costs = CostCalculator()
        engine.observer = self.observe_node

    def create(self, request: str, scenario: str = "SAFE") -> Execution:
        execution = Execution(request=request, scenario=scenario)
        execution.trace_id = self.traces.trace_id(str(execution.execution_id))
        self.repository.save_execution(execution)
        self.audit(execution, "execution.created")
        self._transition(execution, ExecutionStatus.RUNNING, "ingest_request")
        self.emit(execution, "execution.started", status=execution.status)
        try:
            result = self.engine.start({
                "execution_id": str(execution.execution_id),
                "correlation_id": str(execution.correlation_id),
                "request": request, "scenario": scenario,
            })
            self._apply_graph_result(execution, result)
        except Exception as exc:
            execution.error = f"{type(exc).__name__}: {exc}"
            self._transition(execution, ExecutionStatus.FAILED, execution.current_node)
            self.emit(execution, "execution.failed", status=execution.status)
            self.audit(execution, "workflow.failed", {"error_type": type(exc).__name__})
        return execution

    def decide(self, execution_id: UUID, decision: ApprovalDecision) -> Execution:
        execution = self.require(execution_id)
        if execution.status is not ExecutionStatus.WAITING_APPROVAL:
            raise ApprovalConflictError("Execution is not waiting for approval")
        action = "approval.approved" if decision.approved else "approval.rejected"
        self.audit(execution, action, {"actor": decision.actor, "reason": decision.reason}, decision.actor)
        self.emit(execution, action, status=ExecutionStatus.RUNNING)
        self._transition(execution, ExecutionStatus.RUNNING, "approval_interrupt")
        try:
            # Rebuild a missing process-local LangGraph checkpoint from durable input. The
            # deterministic replay stops at the same interrupt and never repeats an approval.
            if not self.engine.snapshot(str(execution_id)):
                self.engine.start({
                    "execution_id": str(execution.execution_id),
                    "correlation_id": str(execution.correlation_id),
                    "request": execution.request,
                    "scenario": execution.scenario,
                })
            result = self.engine.resume(str(execution_id), decision.approved,
                                        decision.actor, decision.reason)
            self._apply_graph_result(execution, result)
        except Exception as exc:
            execution.error = f"{type(exc).__name__}: {exc}"
            self._transition(execution, ExecutionStatus.FAILED, execution.current_node)
            self.emit(execution, "execution.failed", status=execution.status)
            self.audit(execution, "workflow.failed", {"error_type": type(exc).__name__})
        return execution

    def _apply_graph_result(self, execution: Execution, result: dict[str, Any]) -> None:
        state = self.engine.snapshot(str(execution.execution_id))
        execution.current_node = state.get("current_node", execution.current_node)
        execution.risk_level = RiskLevel(state.get("risk_level", RiskLevel.LOW))
        execution.data_sensitivity = DataSensitivity(state.get("sensitivity", DataSensitivity.PUBLIC))
        if "__interrupt__" in result:
            interrupts = result["__interrupt__"]
            approval = interrupts[0].value if interrupts else {}
            execution.requested_action = approval.get("requested_action")
            execution.approval_reason = approval.get("reason")
            execution.evidence = approval.get("evidence", [])
            execution.recommended_decision = approval.get("recommended_decision")
            self._transition(execution, ExecutionStatus.WAITING_APPROVAL, "approval_interrupt")
            self.emit(execution, "approval.requested", agent_id="approval-gate",
                      status=execution.status)
            self.audit(execution, "approval.requested", {"risk_level": execution.risk_level})
        else:
            execution.result = state.get("result")
            target = ExecutionStatus.COMPLETED if execution.result == "APPROVED" else ExecutionStatus.CANCELLED
            self._transition(execution, target, execution.current_node)
            self.emit(execution, "execution.completed", status=execution.status)
            self.audit(execution, "workflow.completed", {"result": execution.result})

    def observe_node(self, event_type: str, node: str, state: WorkflowState) -> None:
        execution_id = state.get("execution_id")
        if not execution_id:
            return
        execution = self.repository.get_execution(UUID(execution_id))
        if not execution:
            return
        invocation = state.get("invocation", {})
        route = state.get("route", {})
        estimated_cost = None
        if invocation and event_type == "agent.completed" and node == "risk-analysis":
            estimated_cost = self.costs.calculate(
                execution.execution_id, ModelInvocation.model_validate(invocation)
            ).estimated_cost_eur
        self.emit(execution, event_type, agent_id=node,
                  status="RUNNING" if event_type == "agent.started" else "COMPLETED",
                  model_class=route.get("model_class"), provider=route.get("provider"),
                  latency_ms=invocation.get("latency_ms"), prompt_tokens=invocation.get("prompt_tokens"),
                  completion_tokens=invocation.get("completion_tokens"),
                  estimated_cost_eur=estimated_cost)
        if node == "risk-analysis" and event_type == "agent.completed" and route:
            self.emit(execution, "routing.selected", agent_id=node,
                      model_class=route.get("model_class"), provider=route.get("provider"))
            self.audit(execution, "routing.decision", {"route": route.get("model_class"),
                                                        "provider": route.get("provider")})

    def _transition(self, execution: Execution, target: ExecutionStatus, node: str) -> None:
        validate_transition(execution.status, target)
        execution.status, execution.current_node = target, node
        execution.updated_at = datetime.now(timezone.utc)
        self.repository.save_execution(execution)

    def emit(self, execution: Execution, event_type: str, **values: Any) -> None:
        if isinstance(values.get("model_class"), str):
            values["model_class"] = ModelClass(values["model_class"])
        event = TelemetryEvent(execution_id=execution.execution_id,
                               correlation_id=execution.correlation_id,
                               event_type=event_type, trace_id=execution.trace_id, **values)
        self.broker.publish(event)
        self.traces.record(event_type, str(execution.execution_id), values)

    def audit(self, execution: Execution, event_type: str, detail: dict[str, Any] | None = None,
              actor: str = "system") -> None:
        self.repository.add_audit(AuditEvent(execution_id=execution.execution_id,
                                             event_type=event_type, detail=detail or {}, actor=actor))

    def require(self, execution_id: UUID) -> Execution:
        execution = self.repository.get_execution(execution_id)
        if not execution:
            raise KeyError(str(execution_id))
        return execution
