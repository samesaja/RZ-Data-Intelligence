"""
RZ Data Intelligence — Celery Scraping Tasks

Two task types:
  1. scrape_url   — Single URL extraction (title, emails, phones, links)
  2. scrape_topic — Topic-based discovery via DuckDuckGo → deep extraction

Scrapling API Reference (from official docs):
  - element.text         → property (NOT callable)
  - page.css('sel')      → returns Adaptors list
  - page.css('sel::text').get(default='') → extract text via pseudo-element
  - element.attrib['href']  → attribute access
  - page.find_by_regex(r'pattern') → regex-based element search
"""
import os
import re
import uuid
import time
import logging
from urllib.parse import urlparse, parse_qs, quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models import Lead, ScrapingJob, JobStatus
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

# Celery tasks use synchronous DB (can't use asyncpg in sync context)
settings = get_settings()
sync_engine = create_engine(settings.database_url_sync, pool_pre_ping=True)
SyncSession = sessionmaker(bind=sync_engine)

# ── Regex Extraction Patterns ────────────────────────────────
EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
)
PHONE_REGEX = re.compile(
    r"(?:\+?\d{1,3}[\s\-.]?)?"       # optional country code
    r"(?:\(?\d{2,4}\)?[\s\-.]?)?"     # optional area code
    r"\d{3,4}[\s\-.]?\d{3,4}",        # main number
)
PHONE_MIN_DIGITS = 7
PHONE_MAX_DIGITS = 15

# Email domains to exclude (false positives from page assets)
EMAIL_BLACKLIST = {
    "example.com", "example.org", "test.com",
    "sentry.io", "wixpress.com", "w3.org",
}


# ── Shared Helpers ───────────────────────────────────────────

def _build_headers(url: str) -> dict:
    """
    Build request headers for Fetcher.get().

    If the target URL is a LinkedIn domain AND the session cookies are
    configured via environment variables, inject them as a Cookie header
    to bypass the login wall.  For all other URLs (or when the env vars
    are missing) an empty dict is returned so scraping works normally.
    """
    parsed = urlparse(url)
    is_linkedin = "linkedin.com" in parsed.netloc.lower()

    if is_linkedin:
        li_at = os.getenv("LINKEDIN_LI_AT", "")
        jsessionid = os.getenv("LINKEDIN_JSESSIONID", "")
        if li_at and jsessionid:
            return {"Cookie": f"li_at={li_at}; JSESSIONID={jsessionid}"}

    return {}


def _clean_phones(raw_phones: list[str]) -> list[str]:
    """Filter phone candidates — must have 7-15 digits to be valid."""
    cleaned = []
    for phone in raw_phones:
        digits_only = re.sub(r"\D", "", phone)
        if PHONE_MIN_DIGITS <= len(digits_only) <= PHONE_MAX_DIGITS:
            cleaned.append(phone.strip())
    return cleaned


def _make_absolute(href: str, base_url: str) -> str:
    """Convert a relative URL to absolute."""
    if href.startswith(("http://", "https://")):
        return href
    if href.startswith("//"):
        parsed = urlparse(base_url)
        return f"{parsed.scheme}:{href}"
    if href.startswith("/"):
        parsed = urlparse(base_url)
        return f"{parsed.scheme}://{parsed.netloc}{href}"
    return href


def _is_valid_email(email: str) -> bool:
    """Reject emails from known false-positive domains."""
    domain = email.split("@")[-1].lower()
    return domain not in EMAIL_BLACKLIST


def _extract_contacts_from_page(page, source_url: str) -> dict:
    """
    Extract title, emails, and phones from a Scrapling page object.

    Uses the correct Scrapling property-based API:
      - page.css('sel::text').get()  for text
      - element.text               as a property (NOT callable)
      - element.attrib['attr']     for attributes

    Returns:
        dict with keys: title, emails, phones
    """
    # Title via CSS ::text pseudo-element
    page_title = page.css("title::text").get(default="Untitled Page")
    page_title = page_title.strip()[:255]

    # Extract full body text for regex scanning
    body_elements = page.css("body")
    full_text = body_elements[0].text if body_elements else ""

    # ── Emails ───────────────────────────────────────
    raw_emails = EMAIL_REGEX.findall(full_text)

    # Also scan mailto: links
    mailto_links = page.css('a[href^="mailto:"]')
    for mailto in mailto_links:
        href = mailto.attrib.get("href", "")
        if href.startswith("mailto:"):
            email = href.replace("mailto:", "").split("?")[0].strip()
            if email and EMAIL_REGEX.match(email):
                raw_emails.append(email)

    # Deduplicate + filter blacklisted domains
    seen_emails = set()
    unique_emails = []
    for email in raw_emails:
        email_lower = email.lower()
        if email_lower not in seen_emails and _is_valid_email(email):
            seen_emails.add(email_lower)
            unique_emails.append(email)

    # ── Phones ───────────────────────────────────────
    raw_phones = PHONE_REGEX.findall(full_text)

    # Also scan tel: links
    tel_links = page.css('a[href^="tel:"]')
    for tel in tel_links:
        href = tel.attrib.get("href", "")
        if href.startswith("tel:"):
            phone = href.replace("tel:", "").strip()
            if phone:
                raw_phones.append(phone)

    unique_phones = list(dict.fromkeys(_clean_phones(raw_phones)))

    return {
        "title": page_title,
        "emails": unique_emails,
        "phones": unique_phones,
    }


# ══════════════════════════════════════════════════════════════
# TASK 1: Single URL Scraping
# ══════════════════════════════════════════════════════════════

@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def scrape_url(self, job_id: str, target_url: str):
    """
    Scrape a single URL using Scrapling and store extracted data as leads.

    Steps:
        1. Set job status to RUNNING
        2. Fetch page with Scrapling Fetcher
        3. Extract title, emails, phones, and links
        4. Create Lead records
        5. Set job status to COMPLETED (or FAILED)
    """
    session = SyncSession()
    try:
        # 1. Update job status → RUNNING
        job = session.query(ScrapingJob).filter(
            ScrapingJob.id == uuid.UUID(job_id)
        ).first()
        if not job:
            logger.error(f"Job {job_id} not found in database")
            return {"status": "error", "message": "Job not found"}

        job.status = JobStatus.RUNNING
        session.commit()

        logger.info(f"[Job {job_id}] Starting URL scrape of {target_url}")

        # 2. Fetch page using Scrapling
        from scrapling import Fetcher

        fetcher = Fetcher(auto_match=False)
        headers = _build_headers(target_url)
        page = fetcher.get(target_url, timeout=30, headers=headers)

        parsed_base = urlparse(target_url)
        domain = parsed_base.netloc

        # 3. Extract contacts using shared helper
        contacts = _extract_contacts_from_page(page, target_url)
        page_title = contacts["title"]
        unique_emails = contacts["emails"]
        unique_phones = contacts["phones"]

        # Extract outbound links
        link_elements = page.css("a[href]")

        logger.info(
            f"[Job {job_id}] Found: {len(unique_emails)} emails, "
            f"{len(unique_phones)} phones, {len(link_elements)} links"
        )

        # 4. Create Lead records
        items_created = 0

        # 4a. Primary lead from the page itself
        lead = Lead(
            company_name=page_title,
            industry="Web Scraping",
            email=unique_emails[0] if unique_emails else None,
            phone=unique_phones[0] if unique_phones else None,
            website=target_url,
            source_url=target_url,
        )
        session.add(lead)
        items_created += 1

        # 4b. Create leads from additional emails found
        for email in unique_emails[1:]:
            lead = Lead(
                company_name=f"{email.split('@')[1].split('.')[0].title()} ({domain})",
                industry="Web Scraping",
                email=email,
                source_url=target_url,
            )
            session.add(lead)
            items_created += 1

        # 4c. Create leads from outbound links (up to 50)
        seen_urls = set()
        for link in link_elements[:50]:
            href = link.attrib.get("href", "")

            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue
            if href in seen_urls:
                continue
            seen_urls.add(href)

            absolute_href = _make_absolute(href, target_url)

            # .text is a PROPERTY — access directly, no parentheses
            link_text = link.text
            link_text = link_text.strip() if link_text else ""

            lead = Lead(
                company_name=(link_text[:255] if link_text else absolute_href[:255]),
                industry="Web Scraping",
                website=absolute_href if absolute_href.startswith("http") else None,
                source_url=target_url,
            )
            session.add(lead)
            items_created += 1

        # 5. Update job → COMPLETED
        job.items_scraped = items_created
        job.status = JobStatus.COMPLETED
        session.commit()

        logger.info(f"[Job {job_id}] URL scrape completed. {items_created} items.")
        return {
            "status": "completed",
            "job_id": job_id,
            "items_scraped": items_created,
            "emails_found": len(unique_emails),
            "phones_found": len(unique_phones),
        }

    except Exception as exc:
        session.rollback()
        try:
            job = session.query(ScrapingJob).filter(
                ScrapingJob.id == uuid.UUID(job_id)
            ).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(exc)[:500]
                session.commit()
        except Exception:
            session.rollback()

        logger.exception(f"[Job {job_id}] URL scrape failed: {exc}")
        raise self.retry(exc=exc)

    finally:
        session.close()


# ══════════════════════════════════════════════════════════════
# TASK 2: Topic-Based Discovery Scraping
# ══════════════════════════════════════════════════════════════

def _extract_ddg_urls(page) -> list[str]:
    """
    Extract result URLs from DuckDuckGo HTML search results page.

    DDG HTML structure:
      - Each result lives in a <div class="result">
      - The link is <a class="result__a" href="...">
      - href contains a DDG redirect: //duckduckgo.com/l/?uddg=ENCODED_URL&rut=...
      - We extract the actual URL from the `uddg` query parameter.
      - Fallback: use `.result__url` text content if redirect parsing fails.
    """
    result_urls = []

    # Method 1: Extract from result link hrefs (redirect URLs)
    result_links = page.css("a.result__a")
    for link in result_links:
        href = link.attrib.get("href", "")

        # DDG wraps results in redirect links with ?uddg= param
        if "uddg=" in href:
            parsed = urlparse(href)
            qs = parse_qs(parsed.query)
            actual_url = qs.get("uddg", [None])[0]
            if actual_url:
                result_urls.append(actual_url)
                continue

        # Direct URL (no redirect wrapper)
        if href.startswith(("http://", "https://")):
            result_urls.append(href)

    # Method 2 (fallback): Extract from displayed URL text
    if not result_urls:
        url_spans = page.css(".result__url")
        for span in url_spans:
            url_text = span.text
            url_text = url_text.strip() if url_text else ""
            if url_text:
                # DDG shows URLs without protocol
                if not url_text.startswith("http"):
                    url_text = f"https://{url_text}"
                result_urls.append(url_text)

    # Deduplicate while preserving order
    seen = set()
    unique_urls = []
    for url in result_urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)

    return unique_urls


def _process_topic_scraping(job_id: str, search_topic: str, max_results: int = 10):
    """
    2-Step Topic-Based Scraping:

    Step 1 (Discovery):
        Search DuckDuckGo HTML for the topic query.
        Paginate through DDG results until we collect `max_results` URLs.
        DDG HTML returns ~30 results per page, using `s=` offset param.

    Step 2 (Deep Extraction):
        For each discovered URL, fetch the page and extract:
        - Page title
        - Email addresses
        - Phone numbers
        Save each successfully extracted contact as a Lead.

    All Scrapling calls use the correct property-based API:
        element.text (property, NOT callable)
        page.css('sel::text').get(default='...')
    """
    session = SyncSession()
    try:
        # ── Set job → RUNNING ────────────────────────────
        job = session.query(ScrapingJob).filter(
            ScrapingJob.id == uuid.UUID(job_id)
        ).first()
        if not job:
            logger.error(f"Job {job_id} not found in database")
            return {"status": "error", "message": "Job not found"}

        job.status = JobStatus.RUNNING
        session.commit()

        logger.info(
            f"[Job {job_id}] Starting topic scrape: '{search_topic}' "
            f"(max_results={max_results})"
        )

        from scrapling import Fetcher
        fetcher = Fetcher(auto_match=False)

        # ── Step 1: Discovery via DuckDuckGo HTML (with pagination) ──
        encoded_topic = quote_plus(search_topic)
        discovered_urls: list[str] = []
        seen_urls: set[str] = set()
        ddg_offset = 0
        max_ddg_pages = (max_results // 25) + 2  # safety cap on pagination loops

        for ddg_page_num in range(max_ddg_pages):
            ddg_url = (
                f"https://html.duckduckgo.com/html/?q={encoded_topic}"
                + (f"&s={ddg_offset}" if ddg_offset > 0 else "")
            )

            logger.info(
                f"[Job {job_id}] Step 1: DDG page {ddg_page_num + 1} → {ddg_url} "
                f"(collected {len(discovered_urls)}/{max_results})"
            )

            ddg_headers = _build_headers(ddg_url)
            ddg_page = fetcher.get(ddg_url, timeout=30, headers=ddg_headers)
            page_urls = _extract_ddg_urls(ddg_page)

            if not page_urls:
                logger.info(f"[Job {job_id}] DDG returned no more results, stopping pagination")
                break

            # Deduplicate against already-collected URLs
            new_count = 0
            for url in page_urls:
                if url not in seen_urls:
                    seen_urls.add(url)
                    discovered_urls.append(url)
                    new_count += 1

            logger.info(f"[Job {job_id}]   Found {new_count} new URLs on this page")

            # Enough URLs collected
            if len(discovered_urls) >= max_results:
                break

            # Parse «Next» page offset from the form's hidden input
            next_forms = ddg_page.css("form input[name='s']")
            if next_forms:
                try:
                    next_offset = int(next_forms[-1].attrib.get("value", "0"))
                    if next_offset > ddg_offset:
                        ddg_offset = next_offset
                    else:
                        break  # no progression, stop
                except (ValueError, TypeError):
                    break
            else:
                # Fallback: increment by ~30 (DDG default page size)
                ddg_offset += 30

            # Polite delay between DDG pages
            time.sleep(1.0)

        # Slice to exact requested amount
        discovered_urls = discovered_urls[:max_results]

        logger.info(
            f"[Job {job_id}] Step 1 complete: "
            f"Discovered {len(discovered_urls)} URLs"
        )

        if not discovered_urls:
            job.status = JobStatus.COMPLETED
            job.items_scraped = 0
            job.error_message = (
                f"No results found for topic: '{search_topic}'"
            )
            session.commit()
            return {
                "status": "completed",
                "job_id": job_id,
                "items_scraped": 0,
                "message": "No search results found",
            }

        # ── Step 2: Deep Extraction per URL ──────────────
        items_created = 0
        urls_processed = 0
        urls_failed = 0

        for i, target_url in enumerate(discovered_urls, 1):
            logger.info(
                f"[Job {job_id}] Step 2: Scraping {i}/{len(discovered_urls)} "
                f"→ {target_url[:80]}"
            )

            try:
                page_headers = _build_headers(target_url)
                page = fetcher.get(target_url, timeout=20, headers=page_headers)

                # Extract contacts using shared helper
                contacts = _extract_contacts_from_page(page, target_url)
                page_title = contacts["title"]
                unique_emails = contacts["emails"]
                unique_phones = contacts["phones"]

                parsed = urlparse(target_url)
                domain = parsed.netloc

                # Create primary lead with best contact info
                lead = Lead(
                    company_name=page_title,
                    industry=search_topic[:128],
                    email=unique_emails[0] if unique_emails else None,
                    phone=unique_phones[0] if unique_phones else None,
                    website=target_url,
                    source_url=f"[topic] {search_topic}",
                )
                session.add(lead)
                items_created += 1

                # Create additional leads for extra emails found
                for email in unique_emails[1:5]:  # cap at 4 extras per page
                    lead = Lead(
                        company_name=(
                            f"{email.split('@')[1].split('.')[0].title()} "
                            f"({domain})"
                        ),
                        industry=search_topic[:128],
                        email=email,
                        source_url=f"[topic] {search_topic}",
                    )
                    session.add(lead)
                    items_created += 1

                urls_processed += 1

                logger.info(
                    f"[Job {job_id}]   ✓ {domain}: "
                    f"{len(unique_emails)} emails, "
                    f"{len(unique_phones)} phones"
                )

            except Exception as page_exc:
                urls_failed += 1
                logger.warning(
                    f"[Job {job_id}]   ✗ Failed to scrape "
                    f"{target_url[:80]}: {page_exc}"
                )
                continue

            # Polite delay between requests (1.5s)
            if i < len(discovered_urls):
                time.sleep(1.5)

        # ── Finalize job ─────────────────────────────────
        job.items_scraped = items_created
        job.status = JobStatus.COMPLETED
        if urls_failed:
            job.error_message = (
                f"Completed with {urls_failed}/{len(discovered_urls)} "
                f"URLs failed"
            )
        session.commit()

        logger.info(
            f"[Job {job_id}] Topic scrape completed. "
            f"{items_created} leads from "
            f"{urls_processed}/{len(discovered_urls)} pages."
        )

        return {
            "status": "completed",
            "job_id": job_id,
            "items_scraped": items_created,
            "urls_discovered": len(discovered_urls),
            "urls_processed": urls_processed,
            "urls_failed": urls_failed,
        }

    except Exception as exc:
        session.rollback()
        try:
            job = session.query(ScrapingJob).filter(
                ScrapingJob.id == uuid.UUID(job_id)
            ).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(exc)[:500]
                session.commit()
        except Exception:
            session.rollback()

        logger.exception(
            f"[Job {job_id}] Topic scrape failed: {exc}"
        )
        raise

    finally:
        session.close()


@celery_app.task(
    name="scrape_topic_task",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
def scrape_topic(self, job_id: str, search_topic: str, max_results: int = 10):
    """
    Celery task wrapper for topic-based discovery scraping.

    Delegates to _process_topic_scraping which handles:
      1. DuckDuckGo search → URL discovery (with pagination)
      2. Per-URL deep extraction → Lead creation
    """
    try:
        return _process_topic_scraping(job_id, search_topic, max_results)
    except Exception as exc:
        logger.exception(
            f"[Job {job_id}] Topic task error, "
            f"retrying ({self.request.retries}/{self.max_retries}): {exc}"
        )
        raise self.retry(exc=exc)
