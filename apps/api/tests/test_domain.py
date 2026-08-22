from uuid import uuid4

import pytest

from app.domain import (
    ExecutionStatus,
    IllegalTransitionError,
    ModelClass,
    ModelInvocation,
    validate_transition,
)
from app.services.cost import CostCalculator


def test_legal_transition():
    validate_transition(ExecutionStatus.QUEUED, ExecutionStatus.RUNNING)


def test_illegal_transition_rejected():
    with pytest.raises(IllegalTransitionError):
        validate_transition(ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING)


def test_cost_calculation():
    invocation = ModelInvocation(
        model_class=ModelClass.FAST,
        provider="litellm",
        model="fast",
        latency_ms=10,
        prompt_tokens=1_000_000,
        completion_tokens=1_000_000,
        output="ok",
    )
    cost = CostCalculator().calculate(uuid4(), invocation)
    assert cost.estimated_cost_eur == pytest.approx(0.75)
