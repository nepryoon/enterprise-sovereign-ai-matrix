from __future__ import annotations

from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.inference import DeterministicFakeInference, LiteLLMInference
from app.api.routes import router
from app.config import Settings, get_settings
from app.graph.workflow import WorkflowEngine
from app.observability.langfuse import TraceAdapter
from app.persistence.database import Repository
from app.routing.policy import RoutingPolicy
from app.security.middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.services.executions import ExecutionService
from app.telemetry.broker import EventBroker


@dataclass
class Container:
    repository: Repository
    broker: EventBroker
    engine: WorkflowEngine
    service: ExecutionService


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    repository = Repository(settings.database_url)
    broker = EventBroker(repository)
    inference = (DeterministicFakeInference() if settings.inference_mode == "fake" else
                 LiteLLMInference(settings.litellm_base_url, settings.litellm_master_key))
    engine = WorkflowEngine(inference, RoutingPolicy(),
                            sovereign_available=settings.sovereign_available)
    execution_service = ExecutionService(repository, broker, engine, TraceAdapter(
        bool(settings.langfuse_public_key and settings.langfuse_secret_key)))
    app = FastAPI(title="Enterprise Sovereign AI Decision Matrix", version="1.0.0",
                  docs_url="/api/docs", redoc_url=None)
    app.state.container = Container(repository, broker, engine, execution_service)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, limit=settings.rate_limit_per_minute)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                       allow_credentials=False, allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type", "Last-Event-ID"])
    app.include_router(router)
    return app


app = create_app()
