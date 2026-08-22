from typing import Literal

from pydantic import BaseModel, Field


class CreateExecutionRequest(BaseModel):
    request: str = Field(min_length=10, max_length=10_000)
    scenario: Literal[
        "SAFE", "HIGH_RISK", "SENSITIVE", "PROVIDER_FAILURE", "TIMEOUT", "MALFORMED_RESPONSE"
    ] = "SAFE"


class DecisionRequest(BaseModel):
    actor: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=1000)
