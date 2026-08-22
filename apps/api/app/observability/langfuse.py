from __future__ import annotations

import hashlib
import logging
from typing import Any

from langfuse import Langfuse

logger = logging.getLogger(__name__)


class TraceAdapter:
    """Failure-isolated observability adapter; sensitive input is never exported."""

    def __init__(self, enabled: bool = False) -> None:
        self.enabled = enabled
        self.client = Langfuse() if enabled else None

    def trace_id(self, execution_id: str) -> str:
        return hashlib.sha256(execution_id.encode()).hexdigest()[:32]

    def record(self, name: str, execution_id: str, metadata: dict[str, Any]) -> None:
        safe = {k: v for k, v in metadata.items() if k not in {"prompt", "response", "request"}}
        try:
            if self.client:
                with self.client.start_as_current_observation(
                    as_type="span",
                    name=name,
                    metadata=safe,
                ):
                    self.client.update_current_trace(
                        session_id=execution_id,
                        metadata={"execution_id": execution_id},
                    )
        except Exception as exc:
            logger.warning("Observability export degraded: %s", type(exc).__name__)
