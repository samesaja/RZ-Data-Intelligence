"""
RZ Data Intelligence — Scraping Jobs API Routes

Endpoints for creating, listing, and inspecting scraping jobs.
Job creation dispatches a Celery task for background processing.
"""
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ScrapingJob, JobStatus
from app.schemas import JobCreate, JobResponse, PaginatedJobs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["Scraping Jobs"])


# ── List Jobs ────────────────────────────────────────────

@router.get("", response_model=PaginatedJobs)
async def list_jobs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(
        None,
        description="Filter by job status (pending, running, completed, failed)",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    List all scraping jobs with optional status filtering and pagination.

    - **status**: Exact match on job status enum value.
    - **page**: 1-indexed page number.
    - **page_size**: Number of items per page (max 100).
    """
    query = select(ScrapingJob)

    if status:
        # Validate against the enum to prevent invalid filter values
        try:
            validated_status = JobStatus(status)
            query = query.where(ScrapingJob.status == validated_status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{status}'. Must be one of: {', '.join(s.value for s in JobStatus)}",
            )

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginated results (newest first)
    query = query.order_by(ScrapingJob.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    jobs = result.scalars().all()

    return PaginatedJobs(
        items=[JobResponse.model_validate(job) for job in jobs],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── Get Single Job ───────────────────────────────────────

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve a single scraping job by its UUID (used for status polling)."""
    result = await db.execute(
        select(ScrapingJob).where(ScrapingJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)


# ── Create Job ───────────────────────────────────────────

@router.post("", response_model=JobResponse, status_code=201)
async def create_job(
    payload: JobCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new scraping job and dispatch it to the Celery worker.

    **Two modes of operation:**
    - **URL mode**: Provide `target_url` to scrape a single page.
    - **Topic mode**: Provide `search_topic` to discover and scrape
      multiple pages via DuckDuckGo search.

    The job starts in PENDING status. The Celery worker transitions it
    through RUNNING → COMPLETED (or FAILED) as processing progresses.
    The frontend polls GET /api/jobs/{id} to track progress.
    """
    is_topic = bool(payload.search_topic)

    # Store the topic as target_url (prefixed) if no URL is given
    job_target = (
        f"[topic] {payload.search_topic}"
        if is_topic
        else str(payload.target_url).strip()
    )

    job = ScrapingJob(target_url=job_target)
    db.add(job)
    await db.flush()
    await db.refresh(job)

    # Dispatch the appropriate Celery task
    try:
        if is_topic:
            from app.worker.tasks import scrape_topic
            scrape_topic.delay(str(job.id), payload.search_topic, payload.max_results)
            logger.info(
                f"Dispatched topic scraping job {job.id} "
                f"for topic: '{payload.search_topic}' (max_results={payload.max_results})"
            )
        else:
            from app.worker.tasks import scrape_url
            scrape_url.delay(str(job.id), payload.target_url)
            logger.info(
                f"Dispatched URL scraping job {job.id} "
                f"for URL: {payload.target_url}"
            )
    except Exception as exc:
        logger.error(f"Failed to dispatch Celery task for job {job.id}: {exc}")
        job.status = JobStatus.FAILED
        job.error_message = f"Task dispatch failed: {str(exc)[:200]}"
        await db.flush()

    return JobResponse.model_validate(job)
