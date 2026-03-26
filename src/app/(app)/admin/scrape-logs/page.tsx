"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrapeModal } from "@/components/scrape/scrape-modal";
import { formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScrapeJob } from "@/types";

function getDurationMs(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return new Date(end).getTime() - new Date(start).getTime();
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

type SortKey = "status" | "trigger" | "started_at" | "completed_at" | "duration" | "listings_scraped" | "listings_evaluated";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "status", label: "Status", align: "left" },
  { key: "trigger", label: "Trigger", align: "left" },
  { key: "started_at", label: "Started", align: "left" },
  { key: "completed_at", label: "Completed", align: "left" },
  { key: "duration", label: "Duration", align: "left" },
  { key: "listings_scraped", label: "Scraped", align: "right" },
  { key: "listings_evaluated", label: "Evaluated", align: "right" },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("started_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false);

  function fetchJobs() {
    fetch("/api/scrape/jobs")
      .then((r) => r.json())
      .then((data) => setJobs(data.data || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (sortKey === "duration") {
        aVal = getDurationMs(a.started_at, a.completed_at);
        bVal = getDurationMs(b.started_at, b.completed_at);
      } else {
        aVal = a[sortKey as keyof ScrapeJob] as string | number | null;
        bVal = b[sortKey as keyof ScrapeJob] as string | number | null;
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [jobs, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Scrape Logs</h1>
          <p className="text-sm text-gray-500">History of scrape and evaluation runs</p>
        </div>
        <Button size="sm" onClick={() => setScrapeModalOpen(true)}>
          Scrape Now
        </Button>
      </div>

      <ScrapeModal
        open={scrapeModalOpen}
        onClose={() => setScrapeModalOpen(false)}
        onComplete={fetchJobs}
      />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          No scrape jobs yet. Run your first scrape from the Dashboard.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100/50 transition-colors",
                      sortKey === col.key ? "text-gray-900" : "text-gray-500",
                      col.align === "right" ? "text-right" : "text-left"
                    )}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className={cn("flex items-center gap-1", col.align === "right" ? "justify-end" : "justify-start")}>
                      {col.label}
                      {sortKey === col.key && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          {sortDir === "asc" ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Error</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={STATUS_COLORS[job.status]}>
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{job.trigger}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateTime(job.started_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateTime(job.completed_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {formatDuration(job.started_at, job.completed_at)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{job.listings_scraped}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{job.listings_evaluated}</td>
                  <td className="px-4 py-3 text-red-600 max-w-[300px] truncate">
                    {job.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
