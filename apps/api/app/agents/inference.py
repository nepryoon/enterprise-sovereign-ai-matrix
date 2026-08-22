from __future__ import annotations

import time
from enum import StrEnum
from typing import Protocol

import httpx

from app.domain import ModelInvocation, ProviderUnavailableError, RoutingDecision


class FakeScenario(StrEnum):
    SAFE = "SAFE"
    HIGH_RISK = "HIGH_RISK"
    SENSITIVE = "SENSITIVE"
    PROVIDER_FAILURE = "PROVIDER_FAILURE"
    TIMEOUT = "TIMEOUT"
    MALFORMED_RESPONSE = "MALFORMED_RESPONSE"


class InferenceClient(Protocol):
    def invoke(self, prompt: str, route: RoutingDecision, scenario: str) -> ModelInvocation: ...


class DeterministicFakeInference:
    RESPONSES = {
        FakeScenario.SAFE: "Risk LOW. Proceed with standard controls.",
        FakeScenario.HIGH_RISK: "Risk HIGH. Production blast radius requires approval.",
        FakeScenario.SENSITIVE: "Risk HIGH. Restricted material processed locally.",
        FakeScenario.MALFORMED_RESPONSE: "{invalid",
    }

    def invoke(self, prompt: str, route: RoutingDecision, scenario: str) -> ModelInvocation:
        selected = FakeScenario(scenario)
        if selected is FakeScenario.PROVIDER_FAILURE:
            raise ProviderUnavailableError(f"Provider {route.provider} unavailable")
        if selected is FakeScenario.TIMEOUT:
            raise TimeoutError("Deterministic inference timeout")
        output = self.RESPONSES[selected]
        return ModelInvocation(
            model_class=route.model_class,
            provider=route.provider,
            model=route.model,
            latency_ms=25,
            prompt_tokens=max(1, len(prompt.split())),
            completion_tokens=len(output.split()),
            output=output,
        )


class LiteLLMInference:
    def __init__(self, base_url: str, api_key: str, timeout: float = 30) -> None:
        self.base_url, self.api_key, self.timeout = base_url.rstrip("/"), api_key, timeout

    def invoke(self, prompt: str, route: RoutingDecision, scenario: str) -> ModelInvocation:
        started = time.monotonic()
        try:
            response = httpx.post(
                f"{self.base_url}/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": route.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderUnavailableError(
                f"Inference gateway unavailable: {type(exc).__name__}"
            ) from exc
        data = response.json()
        usage = data.get("usage", {})
        return ModelInvocation(
            model_class=route.model_class,
            provider=route.provider,
            model=route.model,
            latency_ms=round((time.monotonic() - started) * 1000),
            prompt_tokens=int(usage.get("prompt_tokens", 0)),
            completion_tokens=int(usage.get("completion_tokens", 0)),
            output=str(data["choices"][0]["message"]["content"]),
        )
