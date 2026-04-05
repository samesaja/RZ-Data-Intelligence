"""
RZ Data Intelligence — Application Settings
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ────────────────────────────────
    app_name: str = "RZ Data Intelligence"
    debug: bool = False
    secret_key: str = "change-me"

    # ── Database ───────────────────────────
    database_url: str = "postgresql+asyncpg://rz_user:rz_secret_password_change_me@localhost:5432/rz_data_intelligence"
    database_url_sync: str = "postgresql://rz_user:rz_secret_password_change_me@localhost:5432/rz_data_intelligence"

    # ── Redis / Celery ─────────────────────
    redis_url: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
