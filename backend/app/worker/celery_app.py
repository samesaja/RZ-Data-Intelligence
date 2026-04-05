"""
RZ Data Intelligence — Celery Application Configuration
"""
from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "rz_data_intelligence",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
)
