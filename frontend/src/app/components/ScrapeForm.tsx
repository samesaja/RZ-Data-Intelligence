"use client";

import React, { useState, useCallback } from "react";
import { createJob, fetchJobStatus, type ScrapingJob } from "@/lib/api";

/**
 * ScrapeForm.tsx — Dual-mode scraping form
 *
 * Modes:
 *   1. URL Mode  → POST { target_url: "..." }
 *   2. Topic Mode → POST { search_topic: "..." }
 *
 * Preserves: loading states, job polling, error handling
 */

type ScrapeMode = "url" | "topic";

const MODE_CONFIG = {
  url: {
    label: "Scrape URL",
    placeholder: "https://example.com/directory",
    inputType: "url" as const,
    description: "Extract leads from a single target URL.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
      />
    ),
    buttonText: "Start Scraping",
  },
  topic: {
    label: "Search Topic",
    placeholder: "e.g., Klinik Kecantikan di Bali",
    inputType: "text" as const,
    description: "Discover & scrape multiple pages via topic search.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    ),
    buttonText: "Search & Scrape",
  },
};

export default function ScrapeForm({
  onJobComplete,
}: {
  onJobComplete?: () => void;
}) {
  const [mode, setMode] = useState<ScrapeMode>("url");
  const [inputValue, setInputValue] = useState("");
  const [maxResults, setMaxResults] = useState(10);
  const [customMaxInput, setCustomMaxInput] = useState("");
  const [isCustomMax, setIsCustomMax] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<ScrapingJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = MODE_CONFIG[mode];

  // ── Job Polling ─────────────────────────────────────────
  const pollJobStatus = useCallback(
    async (jobId: string) => {
      let attempts = 0;
      const poll = async () => {
        if (attempts >= 60) {
          setError("Job polling timed out.");
          setIsSubmitting(false);
          return;
        }
        try {
          const job = await fetchJobStatus(jobId);
          setActiveJob(job);
          if (job.status === "completed") {
            setIsSubmitting(false);
            onJobComplete?.();
            setTimeout(() => setActiveJob(null), 3500);
          } else if (job.status === "failed") {
            setError(job.error_message || "Scraping failed.");
            setIsSubmitting(false);
            setTimeout(() => {
              setActiveJob(null);
              setError(null);
            }, 5000);
          } else {
            attempts++;
            setTimeout(poll, 2000);
          }
        } catch {
          attempts++;
          setTimeout(poll, 3000);
        }
      };
      poll();
    },
    [onJobComplete]
  );

  // ── Form Submit ─────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);
    setActiveJob(null);

    try {
      const payload =
        mode === "url"
          ? { target_url: trimmed }
          : { search_topic: trimmed, max_results: maxResults };

      const job = await createJob(payload);
      setActiveJob(job);
      setInputValue("");
      pollJobStatus(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
      setIsSubmitting(false);
    }
  };

  // ── Mode Switch Handler ─────────────────────────────────
  const switchMode = (newMode: ScrapeMode) => {
    if (isSubmitting) return;
    setMode(newMode);
    setInputValue("");
    setError(null);
  };

  // ── Status Badge Map ────────────────────────────────────
  const statusMap: Record<
    string,
    { label: string; class: string; dot: string }
  > = {
    pending: {
      label: "Queued",
      class: "badge badge-amber",
      dot: "bg-amber",
    },
    running: {
      label: mode === "topic" ? "Discovering..." : "Scraping...",
      class: "badge badge-cyan",
      dot: "bg-cyan animate-pulse",
    },
    completed: {
      label: "Done",
      class: "badge badge-emerald",
      dot: "bg-emerald",
    },
    failed: {
      label: "Failed",
      class: "badge badge-red",
      dot: "bg-red",
    },
  };

  return (
    <div className="glass-card-static p-5 animate-fade-in">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-text-primary">
          New Scraping Job
        </h2>
        <p className="text-[0.75rem] text-text-muted mt-0.5">
          {config.description}
        </p>
      </div>

      {/* ── Mode Toggle ─────────────────────────────────── */}
      <div className="mb-3.5 flex gap-1 rounded-lg bg-[var(--surface-container-lowest)] p-0.5 w-fit">
        {(["url", "topic"] as ScrapeMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            disabled={isSubmitting}
            className={`
              relative flex items-center gap-1.5 rounded-md px-3 py-1.5
              text-[0.75rem] font-medium
              transition-all duration-200 ease-out
              disabled:opacity-40 disabled:cursor-not-allowed
              ${
                mode === m
                  ? `bg-[var(--surface-container-high)] text-text-primary
                     shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]`
                  : `text-text-dim hover:text-text-muted
                     hover:bg-[var(--surface-container-low)]`
              }
            `}
          >
            <svg
              className={`h-3 w-3 transition-colors duration-200 ${
                mode === m ? "text-indigo" : "text-text-dim"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              {MODE_CONFIG[m].icon}
            </svg>
            {MODE_CONFIG[m].label}
            {/* Active indicator bar */}
            {mode === m && (
              <span className="absolute -bottom-0.5 left-3 right-3 h-[2px] rounded-full bg-indigo" />
            )}
          </button>
        ))}
      </div>

      {/* ── Input Form ──────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex gap-2.5">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className={`h-3.5 w-3.5 transition-colors duration-200 ${
                mode === "topic" ? "text-cyan" : "text-text-dim"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              {config.icon}
            </svg>
          </div>
          <input
            id="scrape-input"
            type={config.inputType}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={config.placeholder}
            required
            disabled={isSubmitting}
            className="rz-input pl-9 h-9 disabled:opacity-40"
          />
        </div>
        <button
          id="scrape-submit-btn"
          type="submit"
          disabled={isSubmitting || !inputValue.trim()}
          className="btn-primary h-9 whitespace-nowrap text-[0.8125rem]"
        >
          {isSubmitting ? (
            <>
              <svg
                className="h-3.5 w-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Processing
            </>
          ) : (
            <>
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                {mode === "topic" ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                  />
                )}
              </svg>
              {config.buttonText}
            </>
          )}
        </button>
      </form>

      {/* ── Target Amount (Topic mode only) ─────────────── */}
      {mode === "topic" && (
        <div className="mt-3 flex items-center gap-3 animate-slide-down">
          <span className="text-[0.6875rem] text-text-muted whitespace-nowrap">
            Target:
          </span>
          <div className="flex items-center gap-1.5">
            {[10, 20, 50].map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setMaxResults(preset);
                  setIsCustomMax(false);
                  setCustomMaxInput("");
                }}
                className={`
                  h-7 min-w-[2.25rem] rounded-md px-2 text-[0.6875rem] font-medium
                  transition-all duration-150 tabular-nums
                  disabled:opacity-30 disabled:cursor-not-allowed
                  ${!isCustomMax && maxResults === preset
                    ? "bg-indigo/15 text-indigo border border-indigo/30 shadow-[0_0_6px_rgba(99,102,241,0.15)]"
                    : "text-text-muted border border-border hover:text-text-secondary hover:border-text-dim hover:bg-card-hover"
                  }
                `}
              >
                {preset}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsCustomMax(true);
                  setCustomMaxInput(String(maxResults > 50 ? maxResults : ""));
                }}
                className={`
                  h-7 rounded-md px-2 text-[0.6875rem] font-medium
                  transition-all duration-150
                  disabled:opacity-30 disabled:cursor-not-allowed
                  ${isCustomMax
                    ? "bg-indigo/15 text-indigo border border-indigo/30 shadow-[0_0_6px_rgba(99,102,241,0.15)]"
                    : "text-text-muted border border-border hover:text-text-secondary hover:border-text-dim hover:bg-card-hover"
                  }
                `}
              >
                Custom
              </button>
              {isCustomMax && (
                <input
                  type="number"
                  min={1}
                  value={customMaxInput}
                  onChange={(e) => {
                    setCustomMaxInput(e.target.value);
                    const val = parseInt(e.target.value, 10);
                    if (val >= 1) setMaxResults(val);
                  }}
                  placeholder="e.g. 100"
                  disabled={isSubmitting}
                  className="rz-input h-7 w-20 text-xs tabular-nums text-center"
                />
              )}
            </div>
          </div>
          <span className="text-[0.625rem] text-text-dim tabular-nums">
            {maxResults} pages
          </span>
        </div>
      )}

      {/* ── Live Job Feedback ──────────────────────────── */}
      {activeJob && (
        <div className="mt-3 flex items-center gap-2.5 animate-slide-down">
          <span className={statusMap[activeJob.status]?.class}>
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${statusMap[activeJob.status]?.dot}`}
            />
            {statusMap[activeJob.status]?.label}
          </span>
          {activeJob.status === "completed" && (
            <span className="text-xs text-text-muted">
              {activeJob.items_scraped} items extracted
            </span>
          )}
          {activeJob.status === "running" && mode === "topic" && (
            <span className="text-xs text-text-dim">
              Searching & extracting from multiple pages...
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-red/20 bg-red-dim px-3 py-2 text-xs text-red animate-slide-down">
          {error}
        </div>
      )}
    </div>
  );
}
