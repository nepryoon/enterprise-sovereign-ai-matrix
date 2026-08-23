from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict, cast

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from app.agents.inference import InferenceClient
from app.domain import Criticality, DataSensitivity, RiskLevel
from app.routing.policy import RoutingContext, RoutingPolicy


class WorkflowState(TypedDict, total=False):
    execution_id: str
    correlation_id: str
    request: str
    scenario: str
    sensitivity: str
    criticality: str
    risk_level: str
    current_node: str
    route: dict[str, Any]
    invocation: dict[str, Any]
    approval_required: bool
    approved: bool
    operator: str
    operator_reason: str
    result: str
    error: str


NodeObserver = Callable[[str, str, WorkflowState], None]


class WorkflowEngine:
    def __init__(
        self,
        inference: InferenceClient,
        routing: RoutingPolicy,
        observer: NodeObserver | None = None,
        checkpointer: Any | None = None,
        sovereign_available: bool = True,
    ) -> None:
        self.inference = inference
        self.routing = routing
        self.observer = observer or (lambda _event, _node, _state: None)
        self.sovereign_available = sovereign_available
        self.checkpointer = checkpointer or InMemorySaver()
        self.graph = self._build()

    def _observed(self, name: str, function: Callable[[WorkflowState], dict[str, Any]]) -> Callable:
        def node(state: WorkflowState) -> dict[str, Any]:
            self.observer("agent.started", name, state)
            try:
                result = function(state)
            except Exception:
                self.observer("agent.failed", name, state)
                raise
            self.observer("agent.completed", name, cast(WorkflowState, {**state, **result}))
            return result

        return node

    def _build(self):
        builder = StateGraph(WorkflowState)
        builder.add_node("ingest_request", self._observed("ingest-request", self._ingest))
        builder.add_node(
            "scope_architecture", self._observed("scope-architecture", self._scope_architecture)
        )
        builder.add_node(
            "classify_sensitivity", self._observed("sensitivity-classifier", self._classify)
        )
        builder.add_node(
            "threat_classification", self._observed("threat-classifier", self._threat_classify)
        )
        builder.add_node("cost_envelope", self._observed("cost-envelope", self._cost_envelope))
        builder.add_node("triage", self._observed("triage-agent", self._triage))
        builder.add_node(
            "architecture_assessment",
            self._observed("architecture-assessment", self._architecture_assessment),
        )
        builder.add_node("risk_analysis", self._observed("risk-analysis", self._analyse))
        builder.add_node(
            "compliance_assessment",
            self._observed("compliance-assessment", self._compliance_assessment),
        )
        builder.add_node(
            "finops_assessment", self._observed("finops-assessment", self._finops_assessment)
        )
        builder.add_node(
            "resilience_assessment",
            self._observed("resilience-assessment", self._resilience_assessment),
        )
        builder.add_node(
            "challenge_analysis", self._observed("challenge-agent", self._challenge_analysis)
        )
        builder.add_node("policy_evaluation", self._observed("policy-evaluator", self._policy))
        builder.add_node("approval_interrupt", self._approval)
        builder.add_node("finalise", self._observed("decision-finaliser", self._finalise))
        builder.add_node("reject", self._observed("decision-rejector", self._reject))
        builder.add_edge(START, "ingest_request")
        builder.add_edge("ingest_request", "scope_architecture")
        builder.add_edge("scope_architecture", "classify_sensitivity")
        builder.add_edge("classify_sensitivity", "threat_classification")
        builder.add_edge("threat_classification", "cost_envelope")
        builder.add_edge("cost_envelope", "triage")
        builder.add_edge("triage", "architecture_assessment")
        builder.add_edge("architecture_assessment", "risk_analysis")
        builder.add_edge("risk_analysis", "compliance_assessment")
        builder.add_edge("compliance_assessment", "finops_assessment")
        builder.add_edge("finops_assessment", "resilience_assessment")
        builder.add_edge("resilience_assessment", "challenge_analysis")
        builder.add_edge("challenge_analysis", "policy_evaluation")
        builder.add_conditional_edges(
            "policy_evaluation",
            self._approval_route,
            {"approval": "approval_interrupt", "finalise": "finalise"},
        )
        builder.add_conditional_edges(
            "approval_interrupt",
            self._decision_route,
            {"approved": "finalise", "rejected": "reject"},
        )
        builder.add_edge("finalise", END)
        builder.add_edge("reject", END)
        return builder.compile(checkpointer=self.checkpointer)

    @staticmethod
    def _ingest(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "ingest_request"}

    @staticmethod
    def _scope_architecture(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "scope_architecture"}

    @staticmethod
    def _threat_classify(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "threat_classification"}

    @staticmethod
    def _cost_envelope(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "cost_envelope"}

    @staticmethod
    def _classify(state: WorkflowState) -> dict[str, Any]:
        text = state["request"].lower()
        scenario = state["scenario"]
        if scenario in {"SENSITIVE", "PROVIDER_FAILURE"} or any(
            marker in text for marker in ("restricted", "pii", "secret", "sovereign")
        ):
            sensitivity = DataSensitivity.RESTRICTED
        elif "internal" in text:
            sensitivity = DataSensitivity.INTERNAL
        else:
            sensitivity = DataSensitivity.PUBLIC
        return {"current_node": "classify_sensitivity", "sensitivity": sensitivity.value}

    @staticmethod
    def _triage(state: WorkflowState) -> dict[str, Any]:
        high = state["scenario"] in {"HIGH_RISK", "SENSITIVE"} or any(
            marker in state["request"].lower() for marker in ("production", "delete", "outage")
        )
        criticality = Criticality.HIGH if high else Criticality.LOW
        return {"current_node": "triage", "criticality": criticality.value}

    @staticmethod
    def _architecture_assessment(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "architecture_assessment"}

    def _analyse(self, state: WorkflowState) -> dict[str, Any]:
        context = RoutingContext(
            criticality=Criticality(state["criticality"]),
            sensitivity=DataSensitivity(state["sensitivity"]),
            reasoning_required=state["criticality"] == Criticality.HIGH,
            sovereign_available=self.sovereign_available,
        )
        route = self.routing.select(context)
        invocation = self.inference.invoke(state["request"], route, state["scenario"])
        return {
            "current_node": "risk_analysis",
            "route": route.model_dump(mode="json"),
            "invocation": invocation.model_dump(mode="json"),
        }

    @staticmethod
    def _policy(state: WorkflowState) -> dict[str, Any]:
        output = state["invocation"]["output"]
        if output.startswith("{invalid"):
            raise ValueError("Malformed inference response")
        high = "HIGH" in output or state["criticality"] == Criticality.HIGH
        return {
            "current_node": "policy_evaluation",
            "risk_level": (RiskLevel.HIGH if high else RiskLevel.LOW).value,
            "approval_required": high,
        }

    @staticmethod
    def _compliance_assessment(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "compliance_assessment"}

    @staticmethod
    def _finops_assessment(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "finops_assessment"}

    @staticmethod
    def _resilience_assessment(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "resilience_assessment"}

    @staticmethod
    def _challenge_analysis(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "challenge_analysis"}

    @staticmethod
    def _approval(state: WorkflowState) -> dict[str, Any]:
        decision = interrupt(
            {
                "execution_id": state["execution_id"],
                "requested_action": "Authorise production infrastructure change",
                "risk_level": state["risk_level"],
                "reason": "High-risk policy threshold reached",
                "evidence": [state["invocation"]["output"]],
                "recommended_decision": "Review controls before approval",
            }
        )
        return {
            "current_node": "approval_interrupt",
            "approved": bool(decision["approved"]),
            "operator": str(decision["actor"]),
            "operator_reason": str(decision["reason"]),
        }

    @staticmethod
    def _approval_route(state: WorkflowState) -> str:
        return "approval" if state["approval_required"] else "finalise"

    @staticmethod
    def _decision_route(state: WorkflowState) -> str:
        return "approved" if state["approved"] else "rejected"

    @staticmethod
    def _finalise(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "finalise", "result": "APPROVED"}

    @staticmethod
    def _reject(state: WorkflowState) -> dict[str, Any]:
        return {"current_node": "reject", "result": "REJECTED"}

    def start(self, state: WorkflowState) -> dict[str, Any]:
        return self.graph.invoke(state, config=self.config(state["execution_id"]))

    def resume(self, execution_id: str, approved: bool, actor: str, reason: str) -> dict[str, Any]:
        return self.graph.invoke(
            Command(resume={"approved": approved, "actor": actor, "reason": reason}),
            config=self.config(execution_id),
        )

    def snapshot(self, execution_id: str) -> WorkflowState:
        return self.graph.get_state(self.config(execution_id)).values

    @staticmethod
    def config(execution_id: str) -> dict[str, Any]:
        return {"configurable": {"thread_id": execution_id}}
