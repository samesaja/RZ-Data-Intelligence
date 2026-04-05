"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchLeads, deleteLead, clearAllLeads, deepSearchLead, deepSearchAllLeads, getExportUrl, type Lead } from "@/lib/api";

/**
 * LeadsTable.tsx — High-density data table for Lead model
 *
 * Columns mapped to models.py Lead:
 *   company_name  (String 255, indexed, required)
 *   industry      (String 128, nullable, indexed) → badge
 *   email         (String 255, nullable)
 *   phone         (String 64, nullable)
 *   website       (String 512, nullable) → clickable icon
 *   address       (Text, nullable) → truncated
 *   source_url    (String 1024, nullable) → clickable icon
 *   created_at    (DateTime TZ)
 *
 * Features: search bar, industry filter, pagination, Export CSV
 */

const INDUSTRIES = [
  "All Industries",
  "Technology",
  "Finance",
  "Healthcare",
  "E-Commerce",
  "Education",
  "Web Scraping",
  "Marketing",
  "Real Estate",
  "Other",
];

interface LeadsTableProps {
  refreshTrigger?: number;
  onStatsChange?: (total: number, industry: string, search: string) => void;
}

export default function LeadsTable({ refreshTrigger, onStatsChange }: LeadsTableProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [industry, setIndustry] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deepSearchingIds, setDeepSearchingIds] = useState<Set<string>>(new Set());
  const [isDeepSearchingAll, setIsDeepSearchingAll] = useState(false);

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLeads({
        page,
        page_size: pageSize,
        industry: industry || undefined,
        search: search || undefined,
      });
      setLeads(data.items);
      setTotal(data.total);
      onStatsChange?.(data.total, industry, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
      setLeads([]);
      setTotal(0);
      onStatsChange?.(0, industry, search);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, industry, search, onStatsChange]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads, refreshTrigger]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this lead?")) return;
    try {
      await deleteLead(id);
      loadLeads();
    } catch {
      alert("Failed to delete lead");
    }
  };

  const handleExport = () => {
    window.open(getExportUrl({ industry, search }), "_blank");
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to permanently delete ALL leads? This action cannot be undone.")) return;
    try {
      await clearAllLeads();
      loadLeads();
    } catch {
      alert("Failed to clear leads");
    }
  };

  const handleDeepSearch = async (id: string) => {
    setDeepSearchingIds((prev) => new Set(prev).add(id));
    try {
      await deepSearchLead(id);
      // Refresh after a short delay to let the task start
      setTimeout(() => loadLeads(), 3000);
    } catch {
      alert("Failed to start deep search");
    } finally {
      setTimeout(() => {
        setDeepSearchingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 5000);
    }
  };

  const handleDeepSearchAll = async () => {
    if (!confirm(`Run deep search on all ${total} leads? This will scan contact/about pages for each lead in the background.`)) return;
    setIsDeepSearchingAll(true);
    try {
      const result = await deepSearchAllLeads();
      alert(`${result.message}. Results will appear shortly.`);
      setTimeout(() => loadLeads(), 5000);
    } catch {
      alert("Failed to start deep search");
    } finally {
      setTimeout(() => setIsDeepSearchingAll(false), 8000);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const extractDomain = (url: string): string => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  };

  return (
    <section id="leads" className="animate-fade-in-up stagger-3">
      {/* ── Section Header ───────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Leads Database</h2>
          <p className="text-[0.6875rem] text-text-muted mt-0.5">
            {total.toLocaleString()} records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="clear-leads-btn"
            onClick={handleClearAll}
            disabled={total === 0}
            className="btn-ghost text-xs text-red border border-red/20 hover:bg-red-dim hover:text-red disabled:opacity-30"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Clear All
          </button>
          <button
            id="deep-search-all-btn"
            onClick={handleDeepSearchAll}
            disabled={total === 0 || isDeepSearchingAll}
            className="btn-ghost text-xs text-cyan border border-cyan/20 hover:bg-cyan-dim hover:text-cyan disabled:opacity-30"
          >
            {isDeepSearchingAll ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )}
            {isDeepSearchingAll ? "Searching..." : "Deep Search All"}
          </button>
          <button
            id="export-csv-btn"
            onClick={handleExport}
            disabled={total === 0}
            className="btn-ghost text-xs"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
            {total > 0 && (
              <span className="badge badge-indigo ml-1 text-[0.625rem]">{total.toLocaleString()}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Table Card ───────────────────────────────── */}
      <div className="glass-card-static overflow-hidden">
        {/* ── Toolbar ────────────────────────────────── */}
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                <svg className="h-3.5 w-3.5 text-text-dim" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <input
                id="leads-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search company or email..."
                className="rz-input pl-8 h-8 text-xs"
              />
            </div>
            <button type="submit" className="btn-ghost h-8 text-xs px-3">Search</button>
          </form>

          <select
            id="industry-filter"
            value={industry}
            onChange={(e) => { setIndustry(e.target.value); setPage(1); }}
            className="rz-input h-8 w-auto text-xs pr-8 cursor-pointer"
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind === "All Industries" ? "" : ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>

        {/* ── Table ──────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="rz-table" id="leads-table">
            <thead>
              <tr>
                <th className="w-8 text-center">#</th>
                <th>Company</th>
                <th>Industry</th>
                <th className="hidden md:table-cell">Email</th>
                <th className="hidden lg:table-cell">Phone</th>
                <th className="hidden xl:table-cell w-10 text-center">Web</th>
                <th className="hidden 2xl:table-cell">Address</th>
                <th className="hidden xl:table-cell w-10 text-center">Src</th>
                <th className="hidden sm:table-cell">Created</th>
                <th className="w-10 text-center">Act</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j}><div className="skeleton h-3.5 w-16 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-6 w-6 text-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      <p className="text-xs text-red">{error}</p>
                      <button onClick={loadLeads} className="text-xs text-indigo hover:text-indigo-hover underline underline-offset-2">
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <svg className="h-8 w-8 text-text-dim" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                      </svg>
                      <p className="text-xs text-text-muted">No leads found</p>
                      <p className="text-[0.6875rem] text-text-dim">Start a scraping job to populate your database.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead, idx) => (
                  <tr key={lead.id}>
                    {/* # index */}
                    <td className="text-center text-text-dim text-[0.6875rem] tabular-nums">
                      {(page - 1) * pageSize + idx + 1}
                    </td>

                    {/* company_name + source_url preview */}
                    <td>
                      <div className="font-medium text-text-primary truncate max-w-[180px] text-[0.8125rem]">
                        {lead.company_name}
                      </div>
                    </td>

                    {/* industry → badge */}
                    <td>
                      {lead.industry ? (
                        <span className="badge badge-indigo">{lead.industry}</span>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>

                    {/* email */}
                    <td className="hidden md:table-cell">
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="text-text-secondary hover:text-indigo transition-colors truncate block max-w-[160px]">
                          {lead.email}
                        </a>
                      ) : <span className="text-text-dim">—</span>}
                    </td>

                    {/* phone */}
                    <td className="hidden lg:table-cell text-text-secondary">
                      {lead.phone || <span className="text-text-dim">—</span>}
                    </td>

                    {/* website → icon link */}
                    <td className="hidden xl:table-cell text-center">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tooltip-trigger inline-flex items-center justify-center rounded p-1 text-text-muted hover:text-cyan hover:bg-cyan-dim transition-colors"
                          data-tooltip={extractDomain(lead.website)}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                          </svg>
                        </a>
                      ) : <span className="text-text-dim">—</span>}
                    </td>

                    {/* address (truncated) */}
                    <td className="hidden 2xl:table-cell">
                      {lead.address ? (
                        <span className="text-text-muted truncate block max-w-[140px]" title={lead.address}>
                          {lead.address}
                        </span>
                      ) : <span className="text-text-dim">—</span>}
                    </td>

                    {/* source_url → icon link or topic badge */}
                    <td className="hidden xl:table-cell text-center">
                      {lead.source_url ? (
                        lead.source_url.startsWith("http") ? (
                          <a
                            href={lead.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tooltip-trigger inline-flex items-center justify-center rounded p-1 text-text-muted hover:text-amber hover:bg-amber-dim transition-colors"
                            data-tooltip="Source"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                            </svg>
                          </a>
                        ) : (
                          <span
                            className="tooltip-trigger inline-flex items-center justify-center rounded p-1 text-text-dim"
                            data-tooltip={lead.source_url}
                            title={lead.source_url}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                          </span>
                        )
                      ) : <span className="text-text-dim">—</span>}
                    </td>

                    {/* created_at */}
                    <td className="hidden sm:table-cell text-text-dim text-[0.75rem] tabular-nums whitespace-nowrap">
                      {formatDate(lead.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => handleDeepSearch(lead.id)}
                          disabled={deepSearchingIds.has(lead.id) || !lead.website}
                          className="inline-flex items-center justify-center rounded p-1 text-text-dim hover:bg-cyan-dim hover:text-cyan transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={lead.website ? "Deep Search — Scan subpages for contacts" : "No website URL"}
                        >
                          {deepSearchingIds.has(lead.id) ? (
                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="inline-flex items-center justify-center rounded p-1 text-text-dim hover:bg-red-dim hover:text-red transition-colors"
                          title="Delete lead"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <p className="text-[0.6875rem] text-text-dim tabular-nums">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="btn-ghost h-7 w-7 p-0 justify-center text-[0.6875rem] disabled:opacity-30"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost h-7 px-2 text-[0.6875rem] disabled:opacity-30"
              >
                Prev
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pn: number;
                if (totalPages <= 5) pn = i + 1;
                else if (page <= 3) pn = i + 1;
                else if (page >= totalPages - 2) pn = totalPages - 4 + i;
                else pn = page - 2 + i;
                return (
                  <button
                    key={pn}
                    onClick={() => setPage(pn)}
                    className={`h-7 w-7 rounded-md text-[0.6875rem] font-medium transition-colors ${
                      pn === page
                        ? "bg-indigo text-white"
                        : "text-text-muted hover:bg-card-hover hover:text-text-primary"
                    }`}
                  >
                    {pn}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost h-7 px-2 text-[0.6875rem] disabled:opacity-30"
              >
                Next
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="btn-ghost h-7 w-7 p-0 justify-center text-[0.6875rem] disabled:opacity-30"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
