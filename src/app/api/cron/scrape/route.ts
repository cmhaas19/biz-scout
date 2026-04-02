import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { scrapeListings } from "@/lib/kumo";
import { evaluateListing, selectCalibrationExamples } from "@/lib/evaluator";
import type { Listing, Evaluation } from "@/types";

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();

  // Get all users with valid Kumo tokens
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("*")
    .not("kumo_token", "is", null)
    .eq("is_disabled", false);

  if (!profiles?.length) {
    return NextResponse.json({ message: "No users with valid tokens" });
  }

  const concurrency = await getSetting<number>("scrape.concurrency");
  const model = await getSetting<string>("evaluate.model");
  const maxTokens = await getSetting<number>("evaluate.max_tokens");
  const evalConcurrency = await getSetting<number>("evaluate.concurrency");
  const calibrationMax = await getSetting<number>("evaluate.calibration_max");

  const { data: activePrompt } = await serviceClient
    .from("prompt_templates")
    .select("*")
    .eq("is_active", true)
    .single();

  let totalScraped = 0;
  let totalEvaluated = 0;

  for (const profile of profiles) {
    // Check token expiry
    if (
      profile.kumo_token_expires_at &&
      new Date(profile.kumo_token_expires_at) <= new Date()
    ) {
      continue;
    }

    // Create system-level job
    const { data: job } = await serviceClient
      .from("scrape_jobs")
      .insert({
        user_id: null,
        status: "running",
        trigger: "scheduled",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    try {
      const listings = await scrapeListings(
        profile.kumo_token,
        profile.kumo_filters,
        concurrency
      );

      // Filter to net-new listings only
      const scrapedIds = listings.map((l) => l.id);
      const { data: existingRows } = await serviceClient
        .from("listings")
        .select("id")
        .in("id", scrapedIds);
      const existingIds = new Set((existingRows || []).map((r: { id: string }) => r.id));
      const newListings = listings.filter((l) => !existingIds.has(l.id));

      for (const listing of newListings) {
        await serviceClient.from("listings").insert({
          id: listing.id,
          kumo_link: listing.kumo_link,
          business_name: listing.business_name,
          location: listing.location,
          asking_price: listing.asking_price,
          revenue: listing.revenue,
          earnings: listing.earnings,
          margin_pct: listing.margin_pct,
          multiple: listing.multiple,
          industry: listing.industry,
          date_added: listing.date_added,
          summary: listing.summary,
          top_highlights: listing.top_highlights,
          additional_information: listing.additional_information,
        });
      }

      totalScraped += newListings.length;

      // Evaluate new listings if user has buyer profile
      if (profile.buyer_profile && activePrompt) {
        const toEvaluate = newListings;

        const { data: ratedEvals } = await serviceClient
          .from("evaluations")
          .select("*, listing:listings(*)")
          .eq("user_id", profile.id)
          .not("user_rating", "is", null);

        const calibrationExamples = selectCalibrationExamples(
          (ratedEvals || []) as (Evaluation & { listing: Listing })[],
          calibrationMax
        );

        let evaluated = 0;
        for (const listing of toEvaluate) {
          try {
            const { data: fullListing } = await serviceClient
              .from("listings")
              .select("*")
              .eq("id", listing.id)
              .single();

            if (!fullListing) continue;

            const result = await evaluateListing(
              activePrompt.system_prompt,
              model,
              maxTokens,
              profile.buyer_profile,
              fullListing as Listing,
              calibrationExamples
            );

            await serviceClient.from("evaluations").upsert(
              {
                user_id: profile.id,
                listing_id: listing.id,
                fit_score: result.score,
                fit_notes: result.notes,
                profile_version: profile.buyer_profile_version,
                prompt_version: activePrompt.version,
                evaluated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,listing_id" }
            );
            evaluated++;
          } catch (err) {
            console.error(`Cron eval error for ${listing.id}:`, err);
          }
        }

        totalEvaluated += evaluated;

        await serviceClient
          .from("scrape_jobs")
          .update({
            listings_scraped: listings.length,
            listings_evaluated: evaluated,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job?.id);
      }
    } catch (err) {
      console.error("Cron scrape error:", err);
      if (job) {
        await serviceClient
          .from("scrape_jobs")
          .update({
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    }
  }

  return NextResponse.json({
    scraped: totalScraped,
    evaluated: totalEvaluated,
  });
}
