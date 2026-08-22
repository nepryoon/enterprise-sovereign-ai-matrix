from dataclasses import dataclass

from app.domain import (
    Criticality,
    DataSensitivity,
    ModelClass,
    ProviderUnavailableError,
    RoutingDecision,
)


@dataclass(frozen=True)
class RoutingContext:
    criticality: Criticality
    sensitivity: DataSensitivity
    reasoning_required: bool = False
    latency_objective_ms: int = 3000
    max_cost_eur: float = 0.05
    sovereign_available: bool = True
    fast_available: bool = True
    reasoning_available: bool = True


class RoutingPolicy:
    def select(self, context: RoutingContext) -> RoutingDecision:
        sensitive = context.sensitivity in {
            DataSensitivity.PII, DataSensitivity.RESTRICTED, DataSensitivity.SOVEREIGN
        }
        if sensitive:
            if not context.sovereign_available:
                raise ProviderUnavailableError("Sovereign inference unavailable; cloud fallback denied")
            return self._decision(ModelClass.SOVEREIGN, "ollama", "sovereign",
                                  "Sensitive data requires local processing", False)
        if context.criticality is Criticality.HIGH or context.reasoning_required:
            if not context.reasoning_available:
                raise ProviderUnavailableError("Approved reasoning provider unavailable")
            return self._decision(ModelClass.REASONING, "litellm", "reasoning",
                                  "High criticality requires enhanced reasoning", False)
        if context.criticality is Criticality.MEDIUM:
            return self._decision(ModelClass.BALANCED, "litellm", "balanced",
                                  "Standard internal analysis", True)
        if not context.fast_available:
            return self._decision(ModelClass.BALANCED, "litellm", "balanced",
                                  "Fast provider unavailable; policy-approved fallback", False)
        return self._decision(ModelClass.FAST, "litellm", "fast",
                              "Low-criticality public workload", True)

    @staticmethod
    def _decision(model_class: ModelClass, provider: str, model: str, reason: str,
                  fallback: bool) -> RoutingDecision:
        return RoutingDecision(model_class=model_class, provider=provider, model=model,
                               reason=reason, fallback_allowed=fallback)
