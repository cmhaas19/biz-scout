import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { evaluateListing, selectCalibrationExamples } from "@/lib/evaluator";
import type { Listing, Evaluation } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listing_ids } = await req.json();

  if (!Array.isArray(listing_ids) || listing_ids.length === 0) {
    return NextResponse.json(
      { error: "listing_ids must be a non-empty array" },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.buyer_profile) {
    return NextResponse.json(
      { error: "Buyer profile required for evaluation" },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  const model = await getSetting<string>("evaluate.model");
  const maxTokens = await getSetting<number>("evaluate.max_tokens");
  const calibrationMax = await getSetting<number>("evaluate.calibration_max");

  const { data: activePrompt } = await serviceClient
    .from("prompt_templates")
    .select("*")
    .eq("is_active", true)
    .single();

  if (!activePrompt) {
    return NextResponse.json(
      { error: "No active prompt template" },
      { status: 500 }
    );
  }

  // Get calibration examples
  const { data: ratedEvals } = await serviceClient
    .from("evaluations")
    .select("*, listing:listings(*)")
    .eq("user_id", user.id)
    .not("user_rating", "is", null);

  const calibrationExamples = selectCalibrationExamples(
    (ratedEvals || []) as (Evaluation & { listing: Listing })[],
    calibrationMax
  );

  // Get listings to evaluate
  const { data: listings } = await serviceClient
    .from("listings")
    .select("*")
    .in("id", listing_ids);

  let evaluated = 0;
  const errors: string[] = [];

  for (const listing of listings || []) {
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
          user_id: user.id,
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
      errors.push(
        `${listing.id}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return NextResponse.json({ evaluated, errors });
}
