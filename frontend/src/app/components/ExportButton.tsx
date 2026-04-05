"use client";

import React from "react";
import { getExportUrl } from "@/lib/api";

export default function ExportButton({
  industry,
  search,
  totalLeads,
}: {
  industry?: string;
  search?: string;
  totalLeads: number;
}) {
  const handleExport = () => {
    const url = getExportUrl({ industry, search });
    window.open(url, "_blank");
  };

  return (
    <button
      id="export-csv-btn"
      onClick={handleExport}
      disabled={totalLeads === 0}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-card-hover hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg
        className="h-4 w-4 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      Export CSV
      {totalLeads > 0 && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          {totalLeads}
        </span>
      )}
    </button>
  );
}
