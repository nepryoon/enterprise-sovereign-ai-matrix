from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./matrix.db"
    inference_mode: str = "fake"
    litellm_base_url: str = "http://litellm:4000"
    litellm_master_key: str = "local-development-key"
    sovereign_available: bool = True
    cors_allowed_origins: str = "http://localhost:3000"
    langfuse_host: str = "http://langfuse:3000"
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    rate_limit_per_minute: int = 60
    demo_step_delay_ms: int = 0
    executor_workers: int = 2

    @field_validator("inference_mode")
    @classmethod
    def valid_mode(cls, value: str) -> str:
        if value not in {"fake", "litellm"}:
            raise ValueError("inference_mode must be fake or litellm")
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [v.strip() for v in self.cors_allowed_origins.split(",") if v.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
