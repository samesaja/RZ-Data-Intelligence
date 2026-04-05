"use client";

import React from "react";

/**
 * Header.tsx — Premium top navigation bar
 * Brand: "RZ Data Intelligence" with system status indicator
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6">
        {/* ── Brand ──────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-dim ring-1 ring-indigo/25">
            <svg className="h-4 w-4 text-indigo" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
            </svg>
          </div>
          <div className="leading-none">
            <h1 className="text-[0.9375rem] font-bold tracking-tight text-text-primary">
              RZ Data Intelligence
            </h1>
            <p className="text-[0.6875rem] text-text-dim mt-0.5">
              B2B Leads Scraping Dashboard
            </p>
          </div>
        </div>

        {/* ── Right Section ──────────────────────────── */}
        <div className="flex items-center gap-4">
          {/* Navigation Links */}
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#leads" className="rounded-md px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary hover:bg-card-hover">
              Leads
            </a>
            <a href="#jobs" className="rounded-md px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary hover:bg-card-hover">
              Jobs
            </a>
          </nav>

          <div className="hidden h-4 w-px bg-border md:block" />

          {/* System Status */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald/20 bg-emerald-dim px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
            <span className="text-[0.6875rem] font-semibold text-emerald">Online</span>
          </div>

          {/* Profile Placeholder */}
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-card-hover hover:border-border-hover">
            <svg className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
