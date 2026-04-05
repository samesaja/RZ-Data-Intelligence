"""
RZ Data Intelligence — Pydantic Schemas

Validation layer between HTTP and the database.
All response models use `from_attributes=True` for ORM compatibility.
"""
import uuid
from datetime import datetime
from typing import Optional, Generic, TypeVar

from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.models import JobStatus


# ── Generic Pagination ───────────────────────────────────

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int = 0

    def model_post_init(self, __context) -> None:
        if self.page_size > 0:
            self.total_pages = -(-self.total // self.page_size)  # ceil division


# ── Leads ────────────────────────────────────────────────

class LeadBase(BaseModel):
    """Fields shared across create/update operations."""
    company_name: str = Field(..., min_length=1, max_length=255, examples=["Acme Corp"])
    industry: Optional[str] = Field(None, max_length=128, examples=["Technology"])
    email: Optional[str] = Field(None, max_length=255, examples=["info@acme.com"])
    phone: Optional[str] = Field(None, max_length=64, examples=["+1-555-0100"])
    website: Optional[str] = Field(None, max_length=512, examples=["https://acme.com"])
    address: Optional[str] = Field(None, examples=["123 Main St, New York, NY"])
    source_url: Optional[str] = Field(None, max_length=1024)


class LeadCreate(LeadBase):
    """Schema for creating a new lead."""
    pass


class LeadUpdate(BaseModel):
    """Schema for partial updates — all fields optional."""
    company_name: Optional[str] = Field(None, min_length=1, max_length=255)
    industry: Optional[str] = Field(None, max_length=128)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=64)
    website: Optional[str] = Field(None, max_length=512)
    address: Optional[str] = None
    source_url: Optional[str] = Field(None, max_length=1024)


class LeadResponse(LeadBase):
    """Full lead representation returned from the API."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime


# ── Scraping Jobs ────────────────────────────────────────

class JobCreate(BaseModel):
    """Schema for creating a new scraping job.

    Provide either `target_url` for single URL scraping,
    or `search_topic` for topic-based discovery scraping.
    At least one must be given.
    """
    target_url: Optional[str] = Field(
        None, max_length=1024, examples=["https://example.com/directory"]
    )
    search_topic: Optional[str] = Field(
        None, min_length=3, max_length=255,
        examples=["Software House in Jakarta"],
        description="Topic query for DuckDuckGo-based discovery scraping.",
    )
    max_results: int = Field(
        default=10, ge=1,
        description="Maximum number of search results to scrape (topic mode only). No upper limit.",
        examples=[10, 20, 50, 100],
    )

    @model_validator(mode="after")
    def check_at_least_one_provided(self):
        if not self.target_url and not self.search_topic:
            raise ValueError(
                "Either 'target_url' or 'search_topic' must be provided."
            )
        return self


class JobResponse(BaseModel):
    """Full scraping job representation returned from the API."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    target_url: str
    status: JobStatus
    items_scraped: int
    error_message: Optional[str] = None
    created_at: datetime


# ── Typed Pagination Aliases ─────────────────────────────

PaginatedLeads = PaginatedResponse[LeadResponse]
PaginatedJobs = PaginatedResponse[JobResponse]
