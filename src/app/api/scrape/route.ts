import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { scrapeListings } from "@/lib/kumo";
import { evaluateListing, selectCalibrationExamples } from "@/lib/evaluator";
import type { Listing, Evaluation } from "@/types";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.kumo_token) {
    return NextResponse.json(
      { error: "Kumo not connected. Please connect your Kumo account." },
      { status: 400 }
    );
  }

  if (
    profile.kumo_token_expires_at &&
    new Date(profile.kumo_token_expires_at) <= new Date()
  ) {
    return NextResponse.json(
      { error: "Kumo token expired. Please reconnect." },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  // Create job
  const { data: job } = await serviceClient
    .from("scrape_jobs")
    .insert({
      user_id: user.id,
      status: "running",
      trigger: "manual",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (!job) {
    return NextResponse.json(
      { error: "Failed to create scrape job" },
      { status: 500 }
    );
  }

  // Run scrape asynchronously
  runScrapeAndEvaluate(serviceClient, job.id, profile).catch((err) => {
    console.error("[scrape] Unhandled error:", err);
  });

  console.log("[scrape] Job created:", job.id, "for user:", user.id);
  return NextResponse.json({ job_id: job.id, status: "running" });
}

async function runScrapeAndEvaluate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: any,
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any
) {
  try {
    const concurrency = await getSetting<number>("scrape.concurrency");

    console.log("[scrape] Starting scrape with concurrency:", concurrency);
    console.log("[scrape] User filters:", JSON.stringify(profile.kumo_filters));

    // Scrape
    const listings = await scrapeListings(
      profile.kumo_token,
      profile.kumo_filters,
      concurrency
    );

    console.log("[scrape] Scraped", listings.length, "listings");

    // Filter to net-new listings only
    const scrapedIds = listings.map((l) => l.id);
    const { data: existingRows } = await serviceClient
      .from("listings")
      .select("id")
      .in("id", scrapedIds);
    const existingIds = new Set((existingRows || []).map((r: { id: string }) => r.id));
    const newListings = listings.filter((l) => !existingIds.has(l.id));

    console.log("[scrape] New listings:", newListings.length, "of", listings.length);

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

    await serviceClient
      .from("scrape_jobs")
      .update({ listings_scraped: newListings.length })
      .eq("id", jobId);

    // Evaluate new/un-evaluated listings
    if (profile.buyer_profile) {
      const model = await getSetting<string>("evaluate.model");
      const maxTokens = await getSetting<number>("evaluate.max_tokens");
      const evalConcurrency = await getSetting<number>("evaluate.concurrency");
      const calibrationMax = await getSetting<number>("evaluate.calibration_max");

      const { data: activePrompt } = await serviceClient
        .from("prompt_templates")
        .select("*")
        .eq("is_active", true)
        .single();

      if (!activePrompt) {
        throw new Error("No active prompt template");
      }

      const toEvaluate = newListings;

      // Get calibration examples
      const { data: ratedEvals } = await serviceClient
        .from("evaluations")
        .select("*, listing:listings(*)")
        .eq("user_id", profile.id)
        .not("user_rating", "is", null);

      const calibrationExamples = selectCalibrationExamples(
        (ratedEvals || []) as (Evaluation & { listing: Listing })[],
        calibrationMax
      );

      // Evaluate with concurrency
      let evaluated = 0;
      const queue = [...toEvaluate];

      async function evalWorker() {
        while (queue.length > 0) {
          const listing = queue.shift()!;
          try {
            // Need to get the full listing from DB for evaluation
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
            console.error(`Failed to evaluate listing ${listing.id}:`, err);
          }
        }
      }

      const workers = Array.from(
        { length: Math.min(evalConcurrency, toEvaluate.length || 1) },
        () => evalWorker()
      );
      await Promise.all(workers);

      await serviceClient
        .from("scrape_jobs")
        .update({ listings_evaluated: evaluated })
        .eq("id", jobId);
    }

    await serviceClient
      .from("scrape_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    console.error("[scrape] Job failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await serviceClient
      .from("scrape_jobs")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}
