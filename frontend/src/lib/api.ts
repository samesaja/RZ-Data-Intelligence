/**
 * RZ Data Intelligence — API Client Configuration
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8000";

export interface Lead {
  id: string;
  company_name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  source_url: string | null;
  created_at: string;
}

export interface ScrapingJob {
  id: string;
  target_url: string;
  status: "pending" | "running" | "completed" | "failed";
  items_scraped: number;
  error_message: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ── Leads API ──────────────────────────────────────────────

export async function fetchLeads(params?: {
  page?: number;
  page_size?: number;
  industry?: string;
  search?: string;
}): Promise<PaginatedResponse<Lead>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size)
    searchParams.set("page_size", String(params.page_size));
  if (params?.industry) searchParams.set("industry", params.industry);
  if (params?.search) searchParams.set("search", params.search);

  const res = await fetch(
    `${API_BASE_URL}/api/leads?${searchParams.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.statusText}`);
  return res.json();
}

export async function deleteLead(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/leads/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete lead: ${res.statusText}`);
}

export function getExportUrl(params?: {
  industry?: string;
  search?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (params?.industry) searchParams.set("industry", params.industry);
  if (params?.search) searchParams.set("search", params.search);
  return `${API_BASE_URL}/api/leads/export/csv?${searchParams.toString()}`;
}

export async function clearAllLeads(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/leads/clear`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to clear leads: ${res.statusText}`);
  return res.json();
}

export async function deepSearchLead(
  id: string
): Promise<{ message: string; lead_id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/leads/${id}/deepsearch`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Deep search failed: ${res.statusText}`);
  return res.json();
}

export async function deepSearchAllLeads(): Promise<{
  message: string;
  total_leads: number;
  dispatched: number;
}> {
  const res = await fetch(`${API_BASE_URL}/api/leads/deepsearch-all`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Deep search failed: ${res.statusText}`);
  return res.json();
}

// ── Jobs API ───────────────────────────────────────────────

export async function fetchJobs(params?: {
  page?: number;
  status?: string;
}): Promise<PaginatedResponse<ScrapingJob>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.status) searchParams.set("status", params.status);

  const res = await fetch(
    `${API_BASE_URL}/api/jobs?${searchParams.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.statusText}`);
  return res.json();
}

export async function createJob(
  payload: { target_url: string } | { search_topic: string; max_results?: number }
): Promise<ScrapingJob> {
  const res = await fetch(`${API_BASE_URL}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create job: ${res.statusText}`);
  return res.json();
}

export async function fetchJobStatus(
  jobId: string
): Promise<ScrapingJob> {
  const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(`Failed to fetch job status: ${res.statusText}`);
  return res.json();
}
