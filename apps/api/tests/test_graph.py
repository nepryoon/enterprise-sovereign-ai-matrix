from langgraph.checkpoint.memory import InMemorySaver

from app.agents.inference import DeterministicFakeInference
from app.graph.workflow import WorkflowEngine
from app.routing.policy import RoutingPolicy


def engine():
    return WorkflowEngine(
        DeterministicFakeInference(), RoutingPolicy(), checkpointer=InMemorySaver()
    )


def state(scenario, request="Assess a routine documentation change"):
    return {
        "execution_id": scenario,
        "correlation_id": "correlation",
        "request": request,
        "scenario": scenario,
    }


def test_low_risk_transition():
    result = engine().start(state("SAFE"))
    assert result["result"] == "APPROVED"
    assert "__interrupt__" not in result


def test_high_risk_requires_approval_and_checkpoint_resume():
    graph = engine()
    result = graph.start(state("HIGH_RISK", "Assess production infrastructure change"))
    assert result["__interrupt__"]
    assert graph.snapshot("HIGH_RISK")["approval_required"] is True
    resumed = graph.resume("HIGH_RISK", True, "operator", "controlled rollout")
    assert resumed["result"] == "APPROVED"
    assert resumed["operator"] == "operator"


def test_rejected_execution_aborts():
    graph = engine()
    graph.start(state("HIGH_RISK", "Assess production change"))
    assert graph.resume("HIGH_RISK", False, "operator", "risk rejected")["result"] == "REJECTED"


def test_sensitive_routes_sovereign():
    result = engine().start(state("SENSITIVE", "Restricted production database change"))
    assert result["route"]["model_class"] == "SOVEREIGN"
