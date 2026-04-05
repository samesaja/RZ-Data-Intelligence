"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";

/**
 * Header.tsx — Premium top navigation bar with auth controls
 * Brand: "RZ Data Intelligence" with system status & user menu
 */
export default function Header() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowDropdown(false);
    await signOut();
    router.replace("/auth");
  };

  const displayEmail = user?.email ?? "Unknown";
  const initials = displayEmail
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

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

          {/* ── User Menu ──────────────────────────────── */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 transition-colors hover:bg-card-hover hover:border-border-hover"
            >
              {/* Avatar with initials */}
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-dim text-[0.625rem] font-bold text-indigo">
                {initials}
              </div>
              {/* Email (hidden on small screens) */}
              <span className="hidden max-w-[120px] truncate text-[0.6875rem] font-medium text-text-secondary sm:block">
                {displayEmail}
              </span>
              {/* Chevron */}
              <svg
                className={`h-3 w-3 text-text-dim transition-transform ${showDropdown ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-2xl shadow-black/30 overflow-hidden animate-fade-in">
                {/* User info */}
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {displayEmail}
                  </p>
                  <p className="mt-0.5 text-[0.625rem] text-text-dim">
                    Authenticated via Supabase
                  </p>
                </div>

                {/* Actions */}
                <div className="p-1.5">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red transition-colors hover:bg-red-dim"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
