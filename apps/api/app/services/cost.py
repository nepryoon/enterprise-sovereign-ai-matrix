from decimal import Decimal
from uuid import UUID

from app.domain import CostRecord, ModelInvocation


class CostCalculator:
    """Server-owned pricing table, expressed as EUR per million tokens."""

    RATES = {
        "FAST": (Decimal("0.15"), Decimal("0.60")),
        "BALANCED": (Decimal("0.40"), Decimal("1.60")),
        "REASONING": (Decimal("2.00"), Decimal("8.00")),
        "SOVEREIGN": (Decimal("0"), Decimal("0")),
    }

    def calculate(self, execution_id: UUID, invocation: ModelInvocation) -> CostRecord:
        prompt_rate, completion_rate = self.RATES[invocation.model_class.value]
        amount = (Decimal(invocation.prompt_tokens) * prompt_rate +
                  Decimal(invocation.completion_tokens) * completion_rate) / Decimal(1_000_000)
        return CostRecord(
            execution_id=execution_id, model_class=invocation.model_class,
            provider=invocation.provider, model=invocation.model,
            prompt_tokens=invocation.prompt_tokens, completion_tokens=invocation.completion_tokens,
            latency_ms=invocation.latency_ms, estimated_cost_eur=float(amount),
            pricing_source_or_version="poc-2026-08",
        )
