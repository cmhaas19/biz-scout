"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingDetailPanel } from "@/components/listings/listing-detail-panel";
import { ScrapeModal } from "@/components/scrape/scrape-modal";
import {
  formatRelativeTime,
  formatCurrency,
  formatDateTime,
  formatDuration,
  scoreColor,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardStats, Profile, ListingWithEvaluation } from "@/types";

const FIT_CATEGORIES = [
  {
    label: "Strong Fit",
    key: "strong" as const,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    number: "text-emerald-700",
    params: "score_min=80&score_max=100",
  },
  {
    label: "Good Fit",
    key: "good" as const,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    number: "text-blue-700",
    params: "score_min=60&score_max=79",
  },
  {
    label: "Borderline",
    key: "marginal" as const,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    number: "text-amber-700",
    params: "score_min=40&score_max=59",
  },
  {
    label: "Weak Fit",
    keys: ["weak", "poor"] as const,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    number: "text-red-700",
    params: "score_min=0&score_max=39",
  },
];


export function DashboardClient({ profile }: { profile: Profile }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] =
    useState<ListingWithEvaluation | null>(null);
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false);

  function fetchStats() {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const kumoExpired =
    !profile.kumo_token ||
    !profile.kumo_token_expires_at ||
    new Date(profile.kumo_token_expires_at) <= new Date();

  const profileIncomplete =
    !profile.buyer_profile ||
    (!profile.buyer_profile.financials &&
      !profile.buyer_profile.industries?.length &&
      !profile.buyer_profile.acquisition_target);

  function getCategoryCount(
    cat: (typeof FIT_CATEGORIES)[number],
    breakdown: DashboardStats["score_breakdown"]
  ) {
    if ("keys" in cat && cat.keys) {
      return cat.keys.reduce(
        (sum, k) => sum + (breakdown[k as keyof typeof breakdown] || 0),
        0
      );
    }
    return breakdown[cat.key as keyof typeof breakdown] || 0;
  }

  const totalRecent = stats?.recent_jobs_found || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Home</h1>
        <p className="text-sm text-muted-foreground">Your acquisition search overview</p>
      </div>

      {/* Alert banners */}
      {kumoExpired && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800">
              Your Kumo connection has expired.
            </span>
            <Link href="/setup/kumo">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                Reconnect
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {profileIncomplete && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertDescription className="flex items-center justify-between">
            <span className="text-blue-800">
              Your buyer profile is incomplete. Complete it for more accurate
              scores.
            </span>
            <Link href="/setup/profile">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                Complete Profile
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Last scrape banner */}
      {loading ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : stats?.last_scrape ? (
        <div className="border border-gray-200 rounded-lg bg-white p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                stats.last_scrape.status === "completed"
                  ? "bg-emerald-100 text-emerald-600"
                  : stats.last_scrape.status === "running"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-red-100 text-red-600"
              )}
            >
              {stats.last_scrape.status === "completed" ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : stats.last_scrape.status === "running" ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Last {stats.last_scrape.trigger === "scheduled" ? "scheduled" : "manual"} run
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <span>{formatRelativeTime(stats.last_scrape.started_at)}</span>
                {stats.last_scrape.status === "completed" && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span>{formatDuration(stats.last_scrape.started_at, stats.last_scrape.completed_at)}</span>
                  </>
                )}
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] font-medium",
                    stats.last_scrape.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : stats.last_scrape.status === "running"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-red-100 text-red-700"
                  )}
                >
                  {stats.last_scrape.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {stats.last_scrape.listings_scraped}
              </p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Found</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {stats.last_scrape.listings_evaluated}
              </p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Evaluated</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white p-6 text-center text-sm text-gray-500">
          No scrapes yet.{" "}
          <Link href="/setup/kumo" className="text-primary hover:underline">
            Connect Kumo
          </Link>{" "}
          to get started.
        </div>
      )}

      {/* Fit category cards */}
      {loading ? (
        <div>
          <Skeleton className="h-4 w-48 mb-3" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      ) : stats ? (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Past 7 days — {totalRecent} listings found
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {FIT_CATEGORIES.map((cat) => {
              const count = getCategoryCount(cat, stats.score_breakdown);
              return (
                <Link
                  key={cat.label}
                  href={`/listings?${cat.params}`}
                  className={cn(
                    "rounded-lg border p-4 transition-all hover:shadow-sm group",
                    cat.bg,
                    cat.border
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={cn("text-3xl font-bold", cat.number)}>
                        {count}
                      </p>
                      <p className={cn("text-sm font-medium mt-1", cat.text)}>
                        {cat.label}
                      </p>
                    </div>
                    <svg
                      className={cn(
                        "w-4 h-4 mt-1 opacity-40 group-hover:opacity-70 transition-opacity",
                        cat.text
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Strongest matches table */}
      {loading ? (
        <div>
          <Skeleton className="h-4 w-56 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : stats && stats.top_matches.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Strongest matches — last 30 days
            </p>
            <Link
              href="/listings?score_min=60&sort_key=fit_score&sort_dir=desc"
              className="text-xs text-primary hover:underline font-medium"
            >
              View all
            </Link>
          </div>

          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/95 backdrop-blur-sm">
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                    Fit
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Listing
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Asking
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Industry
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Posted
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.top_matches.map((listing) => (
                  <tr
                    key={listing.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedListing(listing)}
                  >
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold",
                          scoreColor(listing.evaluation?.fit_score ?? 0)
                        )}
                      >
                        {listing.evaluation?.fit_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[400px]">
                        {listing.business_name}
                      </div>
                      <div className="text-xs text-gray-500 truncate max-w-[400px]">
                        {listing.location || "No location"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap hidden md:table-cell">
                      {formatCurrency(listing.asking_price)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[140px] hidden lg:table-cell">
                      {listing.industry || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs hidden sm:table-cell">
                      {formatDateTime(listing.date_added)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !loading && stats ? (
        <div className="border border-gray-200 rounded-lg bg-white p-8 text-center text-sm text-gray-500">
          No strong matches yet. Run a scrape and evaluate listings to see your
          top matches here.
        </div>
      ) : null}

      {/* Scrape modal */}
      <ScrapeModal
        open={scrapeModalOpen}
        onClose={() => setScrapeModalOpen(false)}
        onComplete={fetchStats}
      />

      {/* Detail panel */}
      <ListingDetailPanel
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onUpdate={fetchStats}
      />
    </div>
  );
}
