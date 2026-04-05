"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import ScrapeForm from "./components/ScrapeForm";
import LeadsTable from "./components/LeadsTable";
import JobsTable from "./components/JobsTable";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [currentIndustry, setCurrentIndustry] = useState("");
  const [currentSearch, setCurrentSearch] = useState("");

  // Jobs stats from JobsTable
  const [activeJobs, setActiveJobs] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [failedJobs, setFailedJobs] = useState(0);

  // ── Auth Guard ────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [user, authLoading, router]);

  const handleJobComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLeadsStatsChange = useCallback(
    (total: number, industry: string, search: string) => {
      setTotalLeads(total);
      setCurrentIndustry(industry);
      setCurrentSearch(search);
    },
    []
  );

  const handleJobStats = useCallback(
    (active: number, completed: number, failed: number) => {
      setActiveJobs(active);
      setCompletedJobs(completed);
      setFailedJobs(failed);
    },
    []
  );

  // Loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-indigo border-t-transparent animate-spin" />
          <p className="text-xs text-text-dim">Loading…</p>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect in progress
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Stats Cards ──────────────────────────── */}
        <div className="mb-6 animate-fade-in stagger-1">
          <StatsCards
            totalLeads={totalLeads}
            activeJobs={activeJobs}
            completedJobs={completedJobs}
            failedJobs={failedJobs}
          />
        </div>

        {/* ── Scrape Form ──────────────────────────── */}
        <div className="mb-6 animate-fade-in-up stagger-2">
          <ScrapeForm onJobComplete={handleJobComplete} />
        </div>

        {/* ── Leads Table ──────────────────────────── */}
        <div className="mb-6">
          <LeadsTable
            refreshTrigger={refreshTrigger}
            onStatsChange={handleLeadsStatsChange}
          />
        </div>

        {/* ── Jobs Table ───────────────────────────── */}
        <div className="mb-6">
          <JobsTable
            refreshTrigger={refreshTrigger}
            onJobStats={handleJobStats}
          />
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="border-t border-outline-variant py-6 mt-4">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[0.75rem] text-text-dim">
            © {new Date().getFullYear()} RZ Data Intelligence — B2B Leads
            Scraping Dashboard
          </p>
        </div>
      </footer>
    </div>
  );
}
