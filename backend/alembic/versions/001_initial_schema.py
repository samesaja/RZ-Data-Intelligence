"""001 — Initial Schema: leads & scraping_jobs

Revision ID: 001_initial
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── leads table ──────────────────────────────────
    op.create_table(
        "leads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("industry", sa.String(128), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("website", sa.String(512), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_leads_company_name", "leads", ["company_name"])
    op.create_index("ix_leads_industry", "leads", ["industry"])

    # ── scraping_jobs table ──────────────────────────
    job_status = sa.Enum("pending", "running", "completed", "failed", name="job_status")

    op.create_table(
        "scraping_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("target_url", sa.String(1024), nullable=False),
        sa.Column("status", job_status, server_default="pending"),
        sa.Column("items_scraped", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_scraping_jobs_status", "scraping_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("scraping_jobs")
    op.drop_table("leads")
    sa.Enum(name="job_status").drop(op.get_bind(), checkfirst=True)
