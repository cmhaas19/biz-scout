import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { evaluateListing, selectCalibrationExamples } from "@/lib/evaluator";
import type { Listing, Evaluation } from "@/types";

export const maxDuration = 300;

export async function POST(req: Request) {
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

  const { listing_ids } = await req.json();

  if (!Array.isArray(listing_ids) || listing_ids.length === 0) {
    return new Response(JSON.stringify({ error: "listing_ids required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.buyer_profile) {
    return new Response(
      JSON.stringify({ error: "Buyer profile required for evaluation" }),
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

        log(`Re-evaluating ${listing_ids.length} listing${listing_ids.length === 1 ? "" : "s"}...`);

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

        if (!activePrompt) {
          log("✗ No active prompt template");
          send("error", JSON.stringify({ message: "No active prompt template" }));
          controller.close();
          return;
        }

        log(`Model: ${model}`);
        log(`Prompt: "${activePrompt.name}" (v${activePrompt.version})`);

        const { data: listings } = await serviceClient
          .from("listings")
          .select("*")
          .in("id", listing_ids);

        if (!listings || listings.length === 0) {
          log("✗ No listings found");
          send("error", JSON.stringify({ message: "No listings found" }));
          controller.close();
          return;
        }

        const { data: ratedEvals } = await serviceClient
          .from("evaluations")
          .select("*, listing:listings(*)")
          .eq("user_id", user.id)
          .not("user_rating", "is", null);

        const calibrationExamples = selectCalibrationExamples(
          (ratedEvals || []) as (Evaluation & { listing: Listing })[],
          calibrationMax
        );

        if (calibrationExamples.length > 0) {
          log(`Using ${calibrationExamples.length} calibration examples`);
        }

        let evaluated = 0;
        let errors = 0;
        const queue = [...listings];

        async function evalWorker() {
          while (queue.length > 0) {
            const listing = queue.shift()!;
            try {
              const result = await evaluateListing(
                activePrompt.system_prompt,
                model,
                maxTokens,
                profile.buyer_profile,
                listing as Listing,
                calibrationExamples
              );

              await serviceClient.from("evaluations").upsert(
                {
                  user_id: user!.id,
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
              log(`[${evaluated}/${listings!.length}] ${listing.business_name} → score: ${result.score}`);
            } catch (err) {
              errors++;
              const msg = err instanceof Error ? err.message : "Unknown error";
              log(`✗ Failed: "${listing.business_name}": ${msg}`);
            }
          }
        }

        const workers = Array.from(
          { length: Math.min(evalConcurrency, listings.length) },
          () => evalWorker()
        );
        await Promise.all(workers);

        log(`Complete: ${evaluated} scored, ${errors} errors`);
        send("done", JSON.stringify({ evaluated, errors }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log(`✗ Failed: ${message}`);
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
