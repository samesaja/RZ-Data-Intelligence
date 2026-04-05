"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchJobs, type ScrapingJob } from "@/lib/api";

/**
 * JobsTable.tsx — Scraping jobs monitoring table
 *
 * Columns mapped to models.py ScrapingJob:
 *   target_url    (String 1024, required)
 *   status        (Enum: pending, running, completed, failed) → color badges
 *   items_scraped (Integer, default 0)
 *   error_message (Text, nullable) → visible on hover/expand if failed
 *   created_at    (DateTime TZ)
 */

interface JobsTableProps {
  refreshTrigger?: number;
  onJobStats?: (active: number, completed: number, failed: number) => void;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string; description: string }> = {
  pending:   { label: "Pending",   badge: "badge badge-amber",   dot: "bg-amber",                     description: "Queued for processing" },
  running:   { label: "Running",   badge: "badge badge-cyan",    dot: "bg-cyan animate-pulse",         description: "Actively scraping" },
  completed: { label: "Completed", badge: "badge badge-emerald", dot: "bg-emerald",                    description: "Successfully finished" },
  failed:    { label: "Failed",    badge: "badge badge-red",     dot: "bg-red",                        description: "Encountered an error" },
};

export default function JobsTable({ refreshTrigger, onJobStats }: JobsTableProps) {
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchJobs({ page, status: statusFilter || undefined });
      setJobs(data.items);
      setTotal(data.total);

      // Calculate stats from current page (approximate)
      const active = data.items.filter(j => j.status === "pending" || j.status === "running").length;
      const completed = data.items.filter(j => j.status === "completed").length;
      const failed = data.items.filter(j => j.status === "failed").length;
      onJobStats?.(active, completed, failed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
      setJobs([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, onJobStats]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs, refreshTrigger]);

  // Auto-refresh every 10s for active jobs
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === "pending" || j.status === "running");
    if (!hasActive) return;
    const interval = setInterval(loadJobs, 10000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  const toggleError = (id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const extractDomain = (url: string): string => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <section id="jobs" className="animate-fade-in-up stagger-4">
      {/* ── Section Header ───────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Recent Scraping Jobs</h2>
          <p className="text-[0.6875rem] text-text-muted mt-0.5">
            {total} job{total !== 1 ? "s" : ""} total
          </p>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          {["", "pending", "running", "completed", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-md px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${
                statusFilter === s
                  ? "bg-indigo/15 text-indigo border border-indigo/25"
                  : "text-text-muted hover:text-text-secondary hover:bg-card-hover border border-transparent"
              }`}
            >
              {s ? STATUS_CONFIG[s].label : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table Card ───────────────────────────────── */}
      <div className="glass-card-static overflow-hidden">
        <div className="overflow-x-auto">
          <table className="rz-table" id="jobs-table">
            <thead>
              <tr>
                <th>Target URL</th>
                <th className="w-28">Status</th>
                <th className="w-24 text-right">Items</th>
                <th className="hidden sm:table-cell">Created</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td><div className="skeleton h-3.5 w-48 rounded" /></td>
                    <td><div className="skeleton h-5 w-20 rounded-full" /></td>
                    <td><div className="skeleton h-3.5 w-8 rounded ml-auto" /></td>
                    <td className="hidden sm:table-cell"><div className="skeleton h-3.5 w-24 rounded" /></td>
                    <td></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <p className="text-xs text-red">{error}</p>
                    <button onClick={loadJobs} className="text-xs text-indigo hover:text-indigo-hover underline underline-offset-2 mt-1">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <p className="text-xs text-text-muted">No scraping jobs yet</p>
                    <p className="text-[0.6875rem] text-text-dim mt-0.5">Submit a URL above to get started.</p>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <React.Fragment key={job.id}>
                    <tr>
                      {/* target_url */}
                      <td>
                        <div className="flex items-center gap-2">
                          {job.target_url.startsWith("[topic]") ? (
                            <span
                              className="text-text-secondary truncate max-w-[300px]"
                              title={job.target_url}
                            >
                              <span className="badge badge-cyan text-[0.625rem] mr-1.5">Topic</span>
                              {job.target_url.replace("[topic] ", "")}
                            </span>
                          ) : (
                            <a
                              href={job.target_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-text-secondary hover:text-indigo transition-colors truncate max-w-[300px]"
                              title={job.target_url}
                            >
                              {extractDomain(job.target_url)}
                              <span className="text-text-dim ml-1">
                                {(() => { try { const p = new URL(job.target_url).pathname; return p !== "/" ? p : ""; } catch { return ""; } })()}
                              </span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* status → color-coded badge */}
                      <td>
                        <span className={STATUS_CONFIG[job.status]?.badge} title={STATUS_CONFIG[job.status]?.description}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[job.status]?.dot}`} />
                          {STATUS_CONFIG[job.status]?.label}
                        </span>
                      </td>

                      {/* items_scraped */}
                      <td className="text-right tabular-nums text-text-secondary">
                        {job.items_scraped > 0 ? job.items_scraped.toLocaleString() : (
                          <span className="text-text-dim">0</span>
                        )}
                      </td>

                      {/* created_at */}
                      <td className="hidden sm:table-cell text-text-dim text-[0.75rem] tabular-nums whitespace-nowrap">
                        {formatDate(job.created_at)}
                      </td>

                      {/* Expand error */}
                      <td className="text-center">
                        {job.status === "failed" && job.error_message && (
                          <button
                            onClick={() => toggleError(job.id)}
                            className="inline-flex items-center justify-center rounded p-1 text-text-dim hover:bg-red-dim hover:text-red transition-colors"
                            title="View error details"
                          >
                            <svg className={`h-3.5 w-3.5 transition-transform ${expandedErrors.has(job.id) ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* error_message → expandable row */}
                    {job.status === "failed" && job.error_message && expandedErrors.has(job.id) && (
                      <tr>
                        <td colSpan={5} className="py-0! border-b-0!">
                          <div className="mx-4 mb-3 mt-0.5 rounded-md border border-red/15 bg-red-dim px-3 py-2 animate-slide-down">
                            <p className="text-[0.6875rem] font-medium text-red mb-0.5">Error Message</p>
                            <p className="text-[0.75rem] text-text-muted font-mono leading-relaxed break-all">
                              {job.error_message}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <p className="text-[0.6875rem] text-text-dim tabular-nums">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost h-7 px-2 text-[0.6875rem] disabled:opacity-30"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost h-7 px-2 text-[0.6875rem] disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
