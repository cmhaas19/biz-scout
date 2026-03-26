"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingDetailPanel } from "./listing-detail-panel";
import {
  formatCurrency,
  formatMultiple,
  formatPercent,
  formatRelativeTime,
  scoreColor,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListingWithEvaluation, Profile } from "@/types";

interface ListingsResponse {
  data: ListingWithEvaluation[];
  meta: {
    total_count: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
  last_scrape_completed_at: string | null;
}

export function ListingsClient({ profile }: { profile: Profile }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [listings, setListings] = useState<ListingWithEvaluation[]>([]);
  const [meta, setMeta] = useState({ total_count: 0, page: 1, page_size: 25, total_pages: 0 });
  const [lastScrape, setLastScrape] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<ListingWithEvaluation | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  function updateParamDebounced(key: string, value: string | null, delay = 400) {
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => updateParam(key, value), delay);
  }

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("page_size") || "100", 10);
  const sortKey = searchParams.get("sort_key") || "date_added";
  const sortDir = searchParams.get("sort_dir") || "desc";

  const activeFilterCount = [
    searchParams.get("location_search"),
    searchParams.get("score_min"),
    searchParams.get("score_max"),
    searchParams.get("price_min"),
    searchParams.get("price_max"),
    searchParams.get("date_added_preset") && searchParams.get("date_added_preset") !== "all" ? "1" : null,
    searchParams.get("evaluation_status") && searchParams.get("evaluation_status") !== "all" ? "1" : null,
  ].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);

  const [refreshing, setRefreshing] = useState(false);

  const fetchListings = useCallback(async () => {
    const isInitial = listings.length === 0;
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("page")) params.set("page", "1");
    if (!params.has("page_size")) params.set("page_size", "100");
    if (!params.has("sort_key")) params.set("sort_key", "date_added");
    if (!params.has("sort_dir")) params.set("sort_dir", "desc");

    const res = await fetch(`/api/listings?${params.toString()}`);
    const json: ListingsResponse = await res.json();
    setListings(json.data || []);
    setMeta(json.meta);
    setLastScrape(json.last_scrape_completed_at);
    setLoading(false);
    setRefreshing(false);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key !== "page") params.set("page", "1");
    router.push(`/listings?${params.toString()}`);
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      updateParam("sort_dir", sortDir === "desc" ? "asc" : "desc");
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort_key", key);
      params.set("sort_dir", "desc");
      params.set("page", "1");
      router.push(`/listings?${params.toString()}`);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Header area - fixed */}
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Listings</h1>
            <p className="text-sm text-gray-500">
              {meta.total_count.toLocaleString()} listings
              {lastScrape && <> · Last scrape: {formatRelativeTime(lastScrape)}</>}
            </p>
          </div>
        </div>

        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="gap-2 border-gray-300 bg-white"
          >
            <FilterIcon className="w-4 h-4" />
            {filtersOpen ? "Hide Filters" : "Show Filters"}
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Content area: filters sidebar + table - fills remaining height */}
      <div className={cn("flex min-h-0 flex-1", filtersOpen ? "gap-4" : "gap-0")}>
        {/* Filter sidebar */}
        <div
          className={cn(
            "shrink-0 transition-all duration-200 overflow-hidden self-stretch",
            filtersOpen ? "w-[240px] opacity-100" : "w-0 opacity-0"
          )}
        >
          <div className="w-[240px] border border-gray-200 rounded-lg bg-white overflow-hidden flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-100 bg-gray-50/80 shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filters</span>
              <button
                onClick={() => setFiltersOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Hide filters"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto flex-1" key={searchParams.toString()}>

            {/* Score range */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Match Score
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  className="h-9 text-sm"
                  defaultValue={searchParams.get("score_min") || ""}
                  onChange={(e) => updateParamDebounced("score_min", e.target.value || null, 500)}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  className="h-9 text-sm"
                  defaultValue={searchParams.get("score_max") || ""}
                  onChange={(e) => updateParamDebounced("score_max", e.target.value || null, 500)}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Location
              </Label>
              <Input
                placeholder="e.g. Remote, San Diego..."
                className="h-9 text-sm"
                defaultValue={searchParams.get("location_search") || ""}
                onChange={(e) => updateParamDebounced("location_search", e.target.value || null)}
              />
            </div>

            {/* Price range */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Asking Price
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  className="h-9 text-sm"
                  defaultValue={searchParams.get("price_min") || ""}
                  onChange={(e) => updateParamDebounced("price_min", e.target.value || null, 500)}
                />
                <Input
                  type="number"
                  placeholder="Max"
                  className="h-9 text-sm"
                  defaultValue={searchParams.get("price_max") || ""}
                  onChange={(e) => updateParamDebounced("price_max", e.target.value || null, 500)}
                />
              </div>
            </div>

            {/* Date posted */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Date Posted
              </Label>
              <div className="space-y-1">
                {[
                  { value: "1d", label: "1 day ago" },
                  { value: "3d", label: "3 days ago" },
                  { value: "1w", label: "1 week ago" },
                  { value: "1m", label: "1 month ago" },
                  { value: "3m", label: "3 months ago" },
                  { value: "all", label: "Any time" },
                ].map((opt) => {
                  const current = searchParams.get("date_added_preset") || "all";
                  return (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2.5 py-0.5 cursor-pointer group"
                      onClick={() => updateParam("date_added_preset", opt.value === "all" ? null : opt.value)}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          current === opt.value
                            ? "border-primary"
                            : "border-gray-300 group-hover:border-gray-400"
                        )}
                      >
                        {current === opt.value && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Evaluation status */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Evaluation Status
              </Label>
              <div className="space-y-1">
                {[
                  { value: "all", label: "All" },
                  { value: "scored", label: "Scored" },
                  { value: "unscored", label: "Unscored" },
                  { value: "stale", label: "Stale" },
                ].map((opt) => {
                  const current = searchParams.get("evaluation_status") || "all";
                  return (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2.5 py-0.5 cursor-pointer group"
                      onClick={() => updateParam("evaluation_status", opt.value === "all" ? null : opt.value)}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          current === opt.value
                            ? "border-primary"
                            : "border-gray-300 group-hover:border-gray-400"
                        )}
                      >
                        {current === opt.value && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Fixed footer */}
          <div className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-5 py-2.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-8"
              onClick={() => {
                const params = new URLSearchParams();
                params.set("page", "1");
                params.set("page_size", "100");
                router.push(`/listings?${params.toString()}`);
              }}
            >
              Clear Filters
            </Button>
          </div>
          </div>
        </div>

        {/* Table area */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Table */}
          {loading ? (
            <div className="space-y-2 flex-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="py-16 text-center text-gray-500 flex-1">
              No listings match your filters.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:flex lg:flex-col flex-1 min-h-0">
                <div className="border border-gray-200 rounded-lg bg-white flex flex-col flex-1 min-h-0">
                  {/* Loading indicator */}
                  {refreshing && (
                    <div className="h-0.5 w-full bg-gray-100 overflow-hidden shrink-0">
                      <div className="h-full w-1/3 bg-primary rounded-full animate-[shimmer_1s_ease-in-out_infinite]" style={{ animation: "shimmer 1s ease-in-out infinite" }} />
                    </div>
                  )}
                  {/* Scrollable table with sticky header */}
                  <div className={cn("flex-1 overflow-y-auto min-h-0 transition-opacity duration-150", refreshing && "opacity-50")}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-gray-100 bg-gray-50/95 backdrop-blur-sm">
                          <SortableHeader label="Fit" sortKeyName="fit_score" currentSort={sortKey} currentDir={sortDir} align="center" onSort={handleSort} />
                          <SortableHeader label="Listing" sortKeyName="business_name" currentSort={sortKey} currentDir={sortDir} align="left" onSort={handleSort} />
                          <SortableHeader label="Asking" sortKeyName="asking_price" currentSort={sortKey} currentDir={sortDir} align="right" onSort={handleSort} />
                          <SortableHeader label="Revenue" sortKeyName="revenue" currentSort={sortKey} currentDir={sortDir} align="right" onSort={handleSort} />
                          <SortableHeader label="Earnings" sortKeyName="earnings" currentSort={sortKey} currentDir={sortDir} align="right" onSort={handleSort} />
                          <SortableHeader label="Margin %" sortKeyName="margin_pct" currentSort={sortKey} currentDir={sortDir} align="right" onSort={handleSort} />
                          <SortableHeader label="Multiple" sortKeyName="multiple" currentSort={sortKey} currentDir={sortDir} align="right" onSort={handleSort} />
                          <SortableHeader label="Industry" sortKeyName="industry" currentSort={sortKey} currentDir={sortDir} align="left" onSort={handleSort} />
                          <SortableHeader label="Date" sortKeyName="date_added" currentSort={sortKey} currentDir={sortDir} align="left" onSort={handleSort} />
                          <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listings.map((listing) => (
                          <tr
                            key={listing.id}
                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedListing(listing)}
                          >
                            <td className="px-4 py-3 text-center">
                              {listing.evaluation ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold",
                                    scoreColor(listing.evaluation.fit_score!)
                                  )}
                                >
                                  {listing.evaluation.fit_score}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 truncate max-w-[280px]">
                                {listing.business_name}
                              </div>
                              <div className="text-xs text-gray-500 truncate max-w-[280px]">
                                {listing.location || "No location"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                              {formatCurrency(listing.asking_price)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                              {formatCurrency(listing.revenue)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                              {formatCurrency(listing.earnings)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                              {formatPercent(listing.margin_pct)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                              {formatMultiple(listing.multiple)}
                            </td>
                            <td className="px-4 py-3 text-gray-600 truncate max-w-[140px]">
                              {listing.industry || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                              {listing.date_added
                                ? new Date(listing.date_added).toLocaleDateString("en-CA")
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {listing.evaluation?.user_rating ? (
                                <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                                  {listing.evaluation.user_rating}
                                </Badge>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Fixed footer */}
                  <div className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {meta.total_count > 0
                        ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, meta.total_count)} of ${meta.total_count.toLocaleString()}`
                        : "0 results"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        disabled={page <= 1}
                        onClick={() => updateParam("page", String(page - 1))}
                      >
                        Previous
                      </Button>
                      {meta.total_pages > 1 && (
                        <span className="text-xs text-gray-500 px-1">
                          Page {page} of {meta.total_pages}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        disabled={page >= meta.total_pages}
                        onClick={() => updateParam("page", String(page + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto space-y-2">
                  {listings.map((listing) => (
                    <div
                      key={listing.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedListing(listing)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {listing.business_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {listing.location || "—"} · {listing.industry || "—"}
                          </p>
                        </div>
                        {listing.evaluation && (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold shrink-0",
                              scoreColor(listing.evaluation.fit_score!)
                            )}
                          >
                            {listing.evaluation.fit_score}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span className="">{formatCurrency(listing.asking_price)}</span>
                        <span className="">{formatCurrency(listing.revenue)}</span>
                        <span className="">{formatMultiple(listing.multiple)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Mobile footer */}
                <div className="shrink-0 border-t border-gray-200 bg-white pt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {meta.total_count > 0
                      ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, meta.total_count)} of ${meta.total_count.toLocaleString()}`
                      : "0 results"}
                  </span>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>Prev</Button>
                    <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={page >= meta.total_pages} onClick={() => updateParam("page", String(page + 1))}>Next</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <ListingDetailPanel
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onUpdate={fetchListings}
      />
    </div>
  );
}

function SortableHeader({
  label,
  sortKeyName,
  currentSort,
  currentDir,
  align,
  onSort,
}: {
  label: string;
  sortKeyName: string;
  currentSort: string;
  currentDir: string;
  align: "left" | "right" | "center";
  onSort: (key: string) => void;
}) {
  const isActive = currentSort === sortKeyName;
  const alignClass = align === "right" ? "text-right justify-end" : align === "center" ? "text-center justify-center" : "text-left justify-start";

  return (
    <th
      className={cn(
        "px-4 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100/50 transition-colors",
        isActive ? "text-gray-900" : "text-gray-500",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      )}
      onClick={() => onSort(sortKeyName)}
    >
      <div className={cn("flex items-center gap-1", alignClass)}>
        {label}
        {isActive && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {currentDir === "asc" ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            )}
          </svg>
        )}
        {!isActive && (
          <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
          </svg>
        )}
      </div>
    </th>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
    </svg>
  );
}
