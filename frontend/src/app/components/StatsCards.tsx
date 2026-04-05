"use client";

import React from "react";

/**
 * StatsCards.tsx — KPI stat cards row
 * Maps to: Lead count, ScrapingJob (running/pending), success rate
 */

interface StatsCardsProps {
  totalLeads: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export default function StatsCards({
  totalLeads,
  activeJobs,
  completedJobs,
  failedJobs,
}: StatsCardsProps) {
  const totalFinished = completedJobs + failedJobs;
  const successRate = totalFinished > 0 ? ((completedJobs / totalFinished) * 100).toFixed(1) : "—";

  const cards = [
    {
      label: "Total Leads",
      value: totalLeads.toLocaleString(),
      subtitle: "In database",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      ),
      color: "text-indigo",
      bg: "bg-indigo-dim",
      ring: "ring-indigo/20",
    },
    {
      label: "Active Jobs",
      value: activeJobs.toString(),
      subtitle: "Running / Pending",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
        </svg>
      ),
      color: "text-cyan",
      bg: "bg-cyan-dim",
      ring: "ring-cyan/20",
    },
    {
      label: "Success Rate",
      value: typeof successRate === "string" ? successRate : `${successRate}%`,
      subtitle: `${completedJobs} of ${totalFinished} jobs`,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      ),
      color: "text-emerald",
      bg: "bg-emerald-dim",
      ring: "ring-emerald/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="glass-card group flex items-center gap-4 p-4 animate-fade-in"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.bg} ring-1 ${card.ring} transition-shadow group-hover:ring-2`}>
            <span className={card.color}>{card.icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold tracking-tight text-text-primary leading-none">
              {card.value}
            </p>
            <p className="text-[0.6875rem] font-medium text-text-muted mt-1 leading-none">
              {card.label}
            </p>
            <p className="text-[0.625rem] text-text-dim mt-0.5 leading-none">
              {card.subtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
