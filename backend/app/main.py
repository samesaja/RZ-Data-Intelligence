"""
RZ Data Intelligence — FastAPI Application Entry Point

Configures the ASGI app with:
- Async lifespan (table creation on startup, engine disposal on shutdown)
- CORS middleware for the Next.js frontend
- Router registration for leads and jobs APIs
- Health check endpoint
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.api import leads, jobs

settings = get_settings()

# ── Logging ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup (dev convenience)."""
    logger.info("Starting RZ Data Intelligence API...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified.")
    yield
    await engine.dispose()
    logger.info("Database engine disposed. Shutting down.")


# ── App ──────────────────────────────────────────────────

app = FastAPI(
    title="RZ Data Intelligence API",
    description="B2B Leads Scraping Dashboard — REST API powered by FastAPI, SQLAlchemy 2.0 (async), and Celery.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Next.js dev server
        "http://localhost:80",     # Nginx
        "http://localhost",        # Nginx (no port)
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────
app.include_router(leads.router)
app.include_router(jobs.router)


# ── Health Check ─────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
async def health_check():
    """System health endpoint for load balancers and monitoring."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": "1.0.0",
    }
