import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DashboardStats } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Run all independent queries in parallel
  const [
    { data: profile },
    { data: activePrompt },
    { count: totalListings },
    { count: recentJobsFound },
    { data: evaluations },
    { data: lastJob },
    { data: topListings },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("buyer_profile_version")
      .eq("id", user.id)
      .single(),
    supabase
      .from("prompt_templates")
      .select("version")
      .eq("is_active", true)
      .single(),
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabase
      .from("evaluations")
      .select("fit_score, profile_version, prompt_version")
      .eq("user_id", user.id),
    supabase
      .from("scrape_jobs")
      .select("status, started_at, completed_at, listings_scraped, listings_evaluated, trigger")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("started_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("listings")
      .select(
        `*, evaluations!inner(id, fit_score, fit_notes, profile_version, prompt_version, user_rating, user_notes, evaluated_at)`
      )
      .eq("evaluations.user_id", user.id)
      .gte("evaluations.fit_score", 60)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("date_added", { ascending: false })
      .limit(50),
  ]);

  const profileVersion = profile?.buyer_profile_version || 1;
  const promptVersion = activePrompt?.version || 1;
  const totalEvaluated = evaluations?.length || 0;

  let staleCount = 0;
  const scoreBreakdown = {
    strong: 0,
    good: 0,
    marginal: 0,
    weak: 0,
    poor: 0,
    unscored: (totalListings || 0) - totalEvaluated,
  };

  if (evaluations) {
    for (const ev of evaluations) {
      if (
        ev.profile_version < profileVersion ||
        ev.prompt_version < promptVersion
      ) {
        staleCount++;
      }

      const s = ev.fit_score;
      if (s >= 80) scoreBreakdown.strong++;
      else if (s >= 60) scoreBreakdown.good++;
      else if (s >= 40) scoreBreakdown.marginal++;
      else if (s >= 20) scoreBreakdown.weak++;
      else scoreBreakdown.poor++;
    }
  }

  // Transform and sort top matches by score desc
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topMatches = (topListings || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((l: any) => {
      const ev = l.evaluations?.[0] || null;
      const isStale = ev
        ? ev.profile_version < profileVersion || ev.prompt_version < promptVersion
        : false;
      return {
        id: l.id,
        business_name: l.business_name,
        location: l.location,
        asking_price: l.asking_price,
        revenue: l.revenue,
        earnings: l.earnings,
        margin_pct: l.margin_pct,
        multiple: l.multiple,
        industry: l.industry,
        date_added: l.date_added,
        kumo_link: l.kumo_link,
        summary: l.summary,
        top_highlights: l.top_highlights,
        additional_information: l.additional_information,
        created_at: l.created_at,
        updated_at: l.updated_at,
        evaluation: ev
          ? {
              fit_score: ev.fit_score,
              fit_notes: ev.fit_notes,
              profile_version: ev.profile_version,
              prompt_version: ev.prompt_version,
              is_stale: isStale,
              user_rating: ev.user_rating,
              user_notes: ev.user_notes,
              evaluated_at: ev.evaluated_at,
            }
          : null,
      };
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => (b.evaluation?.fit_score || 0) - (a.evaluation?.fit_score || 0))
    .slice(0, 10);

  const stats: DashboardStats = {
    total_listings: totalListings || 0,
    total_evaluated: totalEvaluated,
    stale_count: staleCount,
    last_scrape_completed_at: lastJob?.completed_at || null,
    score_breakdown: scoreBreakdown,
    last_scrape: lastJob
      ? {
          status: lastJob.status,
          started_at: lastJob.started_at,
          completed_at: lastJob.completed_at,
          listings_scraped: lastJob.listings_scraped,
          listings_evaluated: lastJob.listings_evaluated,
          trigger: lastJob.trigger,
        }
      : null,
    recent_jobs_found: recentJobsFound || 0,
    top_matches: topMatches,
  };

  return NextResponse.json(stats);
}
