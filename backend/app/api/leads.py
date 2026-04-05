"""
RZ Data Intelligence — Leads API Routes

Full CRUD + search/filter + CSV export for Lead model.
All endpoints use async SQLAlchemy sessions.
"""
import csv
import io
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Lead
from app.schemas import LeadCreate, LeadUpdate, LeadResponse, PaginatedLeads

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/leads", tags=["Leads"])


# ── Helpers ──────────────────────────────────────────────

def _apply_filters(query, industry: str | None, search: str | None):
    """Apply optional industry and search filters to a Lead query."""
    if industry:
        query = query.where(Lead.industry.ilike(f"%{industry}%"))
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Lead.company_name.ilike(pattern),
                Lead.email.ilike(pattern),
                Lead.phone.ilike(pattern),
            )
        )
    return query


# ── List Leads ───────────────────────────────────────────

@router.get("", response_model=PaginatedLeads)
async def list_leads(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    industry: Optional[str] = Query(None, description="Filter by industry"),
    search: Optional[str] = Query(None, description="Search company, email, or phone"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all leads with optional filtering, search, and pagination.

    - **industry**: Case-insensitive partial match on industry field.
    - **search**: Case-insensitive partial match on company_name, email, or phone.
    - **page**: 1-indexed page number.
    - **page_size**: Number of items per page (max 100).
    """
    query = _apply_filters(select(Lead), industry, search)

    # Total count (for pagination metadata)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginated results
    query = query.order_by(Lead.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    leads = result.scalars().all()

    return PaginatedLeads(
        items=[LeadResponse.model_validate(lead) for lead in leads],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── Export CSV ───────────────────────────────────────────

CSV_COLUMNS = [
    "ID", "Company Name", "Industry", "Email", "Phone",
    "Website", "Address", "Source URL", "Created At",
]


@router.get("/export/csv")
async def export_leads_csv(
    industry: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Export leads as a downloadable CSV file.
    Supports the same industry and search filters as the list endpoint.
    """
    query = _apply_filters(select(Lead), industry, search)
    query = query.order_by(Lead.created_at.desc())
    result = await db.execute(query)
    leads = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    for lead in leads:
        writer.writerow([
            str(lead.id),
            lead.company_name,
            lead.industry or "",
            lead.email or "",
            lead.phone or "",
            lead.website or "",
            lead.address or "",
            lead.source_url or "",
            lead.created_at.isoformat() if lead.created_at else "",
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=rz_leads_export.csv",
            "Cache-Control": "no-cache",
        },
    )


# ── Get Single Lead ──────────────────────────────────────

@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve a single lead by its UUID."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadResponse.model_validate(lead)


# ── Create Lead ──────────────────────────────────────────

@router.post("", response_model=LeadResponse, status_code=201)
async def create_lead(payload: LeadCreate, db: AsyncSession = Depends(get_db)):
    """Create a new lead record."""
    lead = Lead(**payload.model_dump())
    db.add(lead)
    await db.flush()
    await db.refresh(lead)
    logger.info(f"Created lead: {lead.company_name} (ID: {lead.id})")
    return LeadResponse.model_validate(lead)


# ── Update Lead ──────────────────────────────────────────

@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Partially update an existing lead (only provided fields are changed)."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)

    await db.flush()
    await db.refresh(lead)
    logger.info(f"Updated lead: {lead.company_name} (ID: {lead.id})")
    return LeadResponse.model_validate(lead)


# ── Clear All Leads ──────────────────────────────────────

@router.delete("/clear")
async def clear_all_leads(db: AsyncSession = Depends(get_db)):
    """Permanently delete ALL leads from the database. Used for dev/testing cleanup."""
    result = await db.execute(sa_delete(Lead))
    await db.commit()
    deleted_count = result.rowcount
    logger.info(f"Cleared all leads — {deleted_count} records deleted")
    return {"message": f"All leads cleared ({deleted_count} records deleted)"}


# ── Delete Lead ──────────────────────────────────────────

@router.delete("/{lead_id}", status_code=204)
async def delete_lead(lead_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Permanently delete a lead by its UUID."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.delete(lead)
    logger.info(f"Deleted lead: {lead.company_name} (ID: {lead.id})")
    return Response(status_code=204)
