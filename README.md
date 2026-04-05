# RZ Data Intelligence

> B2B Leads Scraping Dashboard — Manage scraping jobs, store business leads, filter & export.

## Architecture

| Component       | Technology                  | Port  |
| --------------- | --------------------------- | ----- |
| Backend API     | FastAPI (Python 3.11)       | 8000  |
| Task Queue      | Celery + Redis              | —     |
| Scraping Engine | Scrapling                   | —     |
| Database        | PostgreSQL 16               | 5432  |
| Frontend        | Next.js 15 + Tailwind CSS 4 | 3000  |
| Reverse Proxy   | Nginx                       | 80    |

## Quick Start

### Prerequisites

- Docker & Docker Compose v2
- (Optional) Node.js 20+ and Python 3.11+ for local development

### 1. Clone & Configure

```bash
cp .env.example .env
# Edit .env with your preferred passwords/keys
```

### 2. Start All Services

```bash
docker compose up --build -d
```

### 3. Access

| Service         | URL                          |
| --------------- | ---------------------------- |
| Dashboard       | http://localhost:3000         |
| API Docs        | http://localhost:8000/docs    |
| API ReDoc       | http://localhost:8000/redoc   |
| Nginx (Unified) | http://localhost              |

## Development

### Backend (without Docker)

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start API server
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.worker.celery_app worker --loglevel=info
```

### Frontend (without Docker)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

## API Endpoints

### Leads

| Method   | Path                      | Description              |
| -------- | ------------------------- | ------------------------ |
| `GET`    | `/api/leads`              | List leads (paginated)   |
| `GET`    | `/api/leads/{id}`         | Get single lead          |
| `POST`   | `/api/leads`              | Create lead              |
| `PUT`    | `/api/leads/{id}`         | Update lead              |
| `DELETE` | `/api/leads/{id}`         | Delete lead              |
| `GET`    | `/api/leads/export/csv`   | Export as CSV            |

### Scraping Jobs

| Method | Path               | Description           |
| ------ | ------------------ | --------------------- |
| `GET`  | `/api/jobs`        | List jobs (paginated) |
| `GET`  | `/api/jobs/{id}`   | Get job status        |
| `POST` | `/api/jobs`        | Create scraping job   |

### Query Parameters

- `?page=1&page_size=20` — Pagination
- `?industry=Technology` — Filter by industry
- `?search=acme` — Search by company name or email

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── config.py        # Settings
│   │   ├── database.py      # SQLAlchemy setup
│   │   ├── models.py        # ORM models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── api/
│   │   │   ├── leads.py     # Leads CRUD
│   │   │   └── jobs.py      # Jobs endpoints
│   │   └── worker/
│   │       ├── celery_app.py # Celery config
│   │       └── tasks.py     # Scrapling task
│   └── alembic/             # Database migrations
├── frontend/
│   └── src/app/
│       ├── layout.tsx       # Root layout
│       ├── page.tsx         # Dashboard
│       └── components/      # UI components
├── nginx/
│   └── default.conf         # Reverse proxy
├── docker-compose.yml
└── .env.example
```

## License

Private — RZ Data Intelligence
