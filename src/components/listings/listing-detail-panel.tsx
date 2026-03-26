"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
  formatRelativeTime,
  scoreColor,
  scoreLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListingWithEvaluation } from "@/types";

const RATING_OPTIONS = [
  { value: "excellent", label: "Excellent", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "good", label: "Good", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "fair", label: "Fair", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "poor", label: "Poor", color: "bg-red-100 text-red-700 border-red-200" },
];

interface Props {
  listing: ListingWithEvaluation | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function ListingDetailPanel({ listing, onClose, onUpdate }: Props) {
  const [userRating, setUserRating] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    setUserRating(listing?.evaluation?.user_rating ?? null);
    setUserNotes(listing?.evaluation?.user_notes ?? "");
    setSaving(false);
    setReEvaluating(false);
    setNotesDirty(false);
  }, [listing?.id, listing?.evaluation?.user_rating, listing?.evaluation?.user_notes]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && listing) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [listing, onClose]);

  async function saveRating(rating: string) {
    if (!listing) return;
    setUserRating(rating);
    setSaving(true);
    await fetch(`/api/evaluations/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_rating: rating }),
    });
    setSaving(false);
    onUpdate();
  }

  async function saveNotes() {
    if (!listing || !notesDirty) return;
    setSaving(true);
    await fetch(`/api/evaluations/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_notes: userNotes }),
    });
    setSaving(false);
    setNotesDirty(false);
    onUpdate();
  }

  async function handleReEvaluate() {
    if (!listing) return;
    setReEvaluating(true);
    await fetch("/api/evaluations/re-evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_ids: [listing.id] }),
    });
    setReEvaluating(false);
    onUpdate();
  }

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-white border-l border-gray-200 shadow-lg flex flex-col transition-transform duration-200 ease-in-out",
        listing ? "translate-x-0" : "translate-x-full"
      )}
    >
      {listing && (
        <>
          {/* Fixed header */}
          <div className="shrink-0 p-5 pb-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900 leading-tight">
                  {listing.business_name}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {listing.location || "No location"} · {listing.industry || "No industry"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Score */}
            {listing.evaluation && (
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-bold text-2xl",
                    scoreColor(listing.evaluation.fit_score!)
                  )}
                >
                  {listing.evaluation.fit_score}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {scoreLabel(listing.evaluation.fit_score!)}
                  </p>
                  {listing.evaluation.is_stale && (
                    <p className="text-xs text-amber-600">Score may be outdated</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Scored {formatRelativeTime(listing.evaluation.evaluated_at)}
                  </p>
                </div>
                {listing.evaluation.is_stale && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReEvaluate}
                    disabled={reEvaluating}
                  >
                    {reEvaluating ? "Scoring..." : "Re-evaluate"}
                  </Button>
                )}
              </div>
            )}

            {/* AI Notes */}
            {listing.evaluation?.fit_notes && (
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">AI Analysis</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {listing.evaluation.fit_notes}
                </p>
              </div>
            )}

            <Separator className="bg-gray-200" />

            {/* Financials */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Financials</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <FinancialItem label="Asking Price" value={formatCurrency(listing.asking_price)} />
                <FinancialItem label="Revenue" value={formatCurrency(listing.revenue)} />
                <FinancialItem label="Earnings" value={formatCurrency(listing.earnings)} />
                <FinancialItem label="Margin" value={formatPercent(listing.margin_pct)} />
                <FinancialItem label="Multiple" value={formatMultiple(listing.multiple)} />
              </div>
            </div>

            {listing.summary && (
              <>
                <Separator className="bg-gray-200" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Business Summary</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                    {listing.summary}
                  </p>
                </div>
              </>
            )}

            {listing.top_highlights && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Highlights</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                  {listing.top_highlights}
                </p>
              </div>
            )}

            {listing.additional_information && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Additional Information</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                  {listing.additional_information}
                </p>
              </div>
            )}

            {listing.evaluation && (
              <>
                <Separator className="bg-gray-200" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2.5">Your Rating</h3>
                  <div className="flex gap-2 flex-wrap">
                    {RATING_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all",
                          userRating === opt.value
                            ? opt.color + " border-current"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                        onClick={() => saveRating(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Your Notes</h3>
                  <Textarea
                    placeholder="Add your notes about this listing..."
                    value={userNotes}
                    onChange={(e) => {
                      setUserNotes(e.target.value);
                      setNotesDirty(true);
                    }}
                    onBlur={saveNotes}
                    rows={3}
                    className="text-sm"
                  />
                  {saving && (
                    <p className="text-xs text-gray-400 mt-1">Saving...</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Fixed footer */}
          <div className="shrink-0 border-t border-gray-200 p-4">
            <a
              href={listing.kumo_link}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" className="w-full">
                View on Kumo
                <svg className="w-3.5 h-3.5 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </Button>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function FinancialItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-mono font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
