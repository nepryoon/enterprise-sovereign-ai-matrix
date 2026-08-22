from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExecutionStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class DataSensitivity(StrEnum):
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    PII = "PII"
    RESTRICTED = "RESTRICTED"
    SOVEREIGN = "SOVEREIGN"


class ModelClass(StrEnum):
    FAST = "FAST"
    BALANCED = "BALANCED"
    REASONING = "REASONING"
    SOVEREIGN = "SOVEREIGN"


class Criticality(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class DomainError(Exception):
    """Base error safe to translate at the HTTP boundary."""


class IllegalTransitionError(DomainError):
    """Raised before an invalid transition can mutate state."""


class ApprovalConflictError(DomainError):
    """Raised for duplicate or out-of-state human decisions."""


class ProviderUnavailableError(DomainError):
    """Raised when policy permits no available inference provider."""


class RoutingError(DomainError):
    """Raised when no routing policy can satisfy a workload."""


TRANSITIONS: dict[ExecutionStatus, frozenset[ExecutionStatus]] = {
    ExecutionStatus.QUEUED: frozenset({ExecutionStatus.RUNNING, ExecutionStatus.CANCELLED}),
    ExecutionStatus.RUNNING: frozenset({ExecutionStatus.WAITING_APPROVAL, ExecutionStatus.COMPLETED,
                                        ExecutionStatus.FAILED, ExecutionStatus.CANCELLED}),
    ExecutionStatus.WAITING_APPROVAL: frozenset({ExecutionStatus.RUNNING, ExecutionStatus.FAILED,
                                                 ExecutionStatus.CANCELLED}),
    ExecutionStatus.COMPLETED: frozenset(),
    ExecutionStatus.FAILED: frozenset(),
    ExecutionStatus.CANCELLED: frozenset(),
}


def validate_transition(current: ExecutionStatus, target: ExecutionStatus) -> None:
    if target not in TRANSITIONS[current]:
        raise IllegalTransitionError(f"Illegal execution transition: {current} -> {target}")


class Execution(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    execution_id: UUID = Field(default_factory=uuid4)
    correlation_id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    status: ExecutionStatus = ExecutionStatus.QUEUED
    risk_level: RiskLevel = RiskLevel.LOW
    data_sensitivity: DataSensitivity = DataSensitivity.PUBLIC
    current_node: str = "queued"
    request: str
    scenario: str = "SAFE"
    result: str | None = None
    trace_id: str | None = None
    error: str | None = None
    requested_action: str | None = None
    approval_reason: str | None = None
    evidence: list[str] = Field(default_factory=list)
    recommended_decision: str | None = None


class AgentRun(BaseModel):
    agent_id: str
    role: str
    status: str
    model_class: ModelClass | None = None
    latency_ms: int | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    estimated_cost_eur: float = 0


class Decision(BaseModel):
    decision_id: UUID = Field(default_factory=uuid4)
    execution_id: UUID
    kind: str
    outcome: str
    evidence: list[str] = Field(default_factory=list)


class ApprovalRequest(BaseModel):
    execution_id: UUID
    requested_action: str
    reason: str
    evidence: list[str]
    recommended_decision: str


class ApprovalDecision(BaseModel):
    execution_id: UUID
    approved: bool
    actor: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=1000)
    decided_at: datetime = Field(default_factory=utcnow)


class RoutingDecision(BaseModel):
    execution_id: UUID | None = None
    model_class: ModelClass
    provider: str
    model: str
    reason: str
    fallback_allowed: bool


class ModelInvocation(BaseModel):
    model_class: ModelClass
    provider: str
    model: str
    latency_ms: int
    prompt_tokens: int
    completion_tokens: int
    output: str


class CostRecord(BaseModel):
    execution_id: UUID
    model_class: ModelClass
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    cached_tokens: int | None = None
    latency_ms: int
    estimated_cost_eur: float
    pricing_source_or_version: str | None = None


class TraceReference(BaseModel):
    execution_id: UUID
    trace_id: str
    url: str | None = None


class AuditEvent(BaseModel):
    event_id: UUID = Field(default_factory=uuid4)
    execution_id: UUID
    timestamp: datetime = Field(default_factory=utcnow)
    event_type: str
    actor: str = "system"
    detail: dict[str, Any] = Field(default_factory=dict)


class TelemetryEvent(BaseModel):
    schema_version: str = "1.0"
    event_id: UUID = Field(default_factory=uuid4)
    execution_id: UUID
    correlation_id: UUID
    timestamp: datetime = Field(default_factory=utcnow)
    event_type: str
    agent_id: str | None = None
    status: str | None = None
    model_class: ModelClass | None = None
    provider: str | None = None
    latency_ms: int | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    estimated_cost_eur: float | None = None
    trace_id: str | None = None
