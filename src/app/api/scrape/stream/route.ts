import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { scrapeListings } from "@/lib/kumo";
import { evaluateListing, selectCalibrationExamples } from "@/lib/evaluator";
import type { Listing, Evaluation } from "@/types";

export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!profile.kumo_token) {
    return new Response(
      JSON.stringify({ error: "Kumo not connected" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (
    profile.kumo_token_expires_at &&
    new Date(profile.kumo_token_expires_at) <= new Date()
  ) {
    return new Response(
      JSON.stringify({ error: "Kumo token expired" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      function log(message: string) {
        send("log", JSON.stringify({ message, ts: new Date().toISOString() }));
      }

      try {
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
          send("error", JSON.stringify({ message: "Failed to create scrape job" }));
          controller.close();
          return;
        }

        log(`Job created: ${job.id}`);
        send("job_created", JSON.stringify({ job_id: job.id }));

        const concurrency = await getSetting<number>("scrape.concurrency");
        log(`Scrape concurrency: ${concurrency}`);
        log(`Loading search filters...`);

        const filterSummary = profile.kumo_filters
          ? Object.entries(profile.kumo_filters as Record<string, unknown>)
              .filter(([, v]) => v != null)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(", ")
          : "defaults";
        log(`Filters: ${filterSummary || "defaults"}`);

        // Scrape
        log("Starting Kumo search...");
        let lastReported = 0;

        const listings = await scrapeListings(
          profile.kumo_token,
          profile.kumo_filters,
          concurrency,
          (scraped, total) => {
            // Report every 5 or on completion
            if (scraped === total || scraped - lastReported >= 5) {
              log(`Fetching listing details: ${scraped}/${total}`);
              lastReported = scraped;
            }
          }
        );

        log(`Scrape complete: ${listings.length} listings found`);

        // Check which listings already exist
        log("Saving listings to database...");
        const listingIds = listings.map((l) => l.id);
        const { data: existingRows } = await serviceClient
          .from("listings")
          .select("id")
          .in("id", listingIds);
        const existingIds = new Set((existingRows || []).map((r: { id: string }) => r.id));

        for (const listing of listings) {
          await serviceClient.from("listings").upsert(
            {
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
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
        }

        const newCount = listings.filter((l) => !existingIds.has(l.id)).length;
        log(`Saved: ${newCount} new, ${listings.length - newCount} updated`);

        await serviceClient
          .from("scrape_jobs")
          .update({ listings_scraped: listings.length })
          .eq("id", job.id);

        // Evaluate
        if (profile.buyer_profile) {
          const [model, maxTokens, evalConcurrency, calibrationMax, { data: activePrompt }] =
            await Promise.all([
              getSetting<string>("evaluate.model"),
              getSetting<number>("evaluate.max_tokens"),
              getSetting<number>("evaluate.concurrency"),
              getSetting<number>("evaluate.calibration_max"),
              serviceClient
                .from("prompt_templates")
                .select("*")
                .eq("is_active", true)
                .single(),
            ]);

          log(`Evaluation model: ${model}`);

          if (!activePrompt) {
            log("⚠ No active prompt template — skipping evaluation");
          } else {
            log(`Using prompt: "${activePrompt.name}" (v${activePrompt.version})`);

            const { data: existingEvals } = await serviceClient
              .from("evaluations")
              .select("listing_id")
              .eq("user_id", profile.id);

            const evaluatedIds = new Set(
              (existingEvals || []).map((e: { listing_id: string }) => e.listing_id)
            );

            const toEvaluate = listings.filter((l) => !evaluatedIds.has(l.id));
            const skipped = listings.length - toEvaluate.length;

            if (skipped > 0) {
              log(`Skipping ${skipped} already-evaluated listings`);
            }

            if (toEvaluate.length === 0) {
              log("No new listings to evaluate");
            } else {
              log(`Evaluating ${toEvaluate.length} new listings (concurrency: ${evalConcurrency})...`);

              const { data: ratedEvals } = await serviceClient
                .from("evaluations")
                .select("*, listing:listings(*)")
                .eq("user_id", profile.id)
                .not("user_rating", "is", null);

              const calibrationExamples = selectCalibrationExamples(
                (ratedEvals || []) as (Evaluation & { listing: Listing })[],
                calibrationMax
              );

              if (calibrationExamples.length > 0) {
                log(`Using ${calibrationExamples.length} calibration examples from your ratings`);
              }

              let evaluated = 0;
              let evalErrors = 0;
              const queue = [...toEvaluate];

              async function evalWorker() {
                while (queue.length > 0) {
                  const listing = queue.shift()!;
                  try {
                    const result = await evaluateListing(
                      activePrompt.system_prompt,
                      model,
                      maxTokens,
                      profile.buyer_profile,
                      listing as unknown as Listing,
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
                    log(`[${evaluated}/${toEvaluate.length}] ${listing.business_name} → score: ${result.score}`);
                  } catch (err) {
                    evalErrors++;
                    const msg = err instanceof Error ? err.message : "Unknown error";
                    log(`✗ Failed to evaluate "${listing.business_name}": ${msg}`);
                  }
                }
              }

              const workers = Array.from(
                { length: Math.min(evalConcurrency, toEvaluate.length || 1) },
                () => evalWorker()
              );
              await Promise.all(workers);

              log(`Evaluation complete: ${evaluated} scored, ${evalErrors} errors`);

              await serviceClient
                .from("scrape_jobs")
                .update({ listings_evaluated: evaluated })
                .eq("id", job.id);
            }
          }
        } else {
          log("No buyer profile configured — skipping evaluation");
        }

        await serviceClient
          .from("scrape_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        log("Job complete ✓");
        send("done", JSON.stringify({ status: "completed", job_id: job.id }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log(`✗ Job failed: ${message}`);
        send("error", JSON.stringify({ message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
