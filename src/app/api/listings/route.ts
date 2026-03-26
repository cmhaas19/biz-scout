import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(
    parseInt(searchParams.get("page_size") || "100", 10),
    100
  );
  const sortKey = searchParams.get("sort_key") || "date_added";
  const sortDir = searchParams.get("sort_dir") === "asc" ? true : false;

  const scoreMin = searchParams.get("score_min");
  const scoreMax = searchParams.get("score_max");
  const priceMin = searchParams.get("price_min");
  const priceMax = searchParams.get("price_max");
  const revenueMin = searchParams.get("revenue_min");
  const revenueMax = searchParams.get("revenue_max");
  const earningsMin = searchParams.get("earnings_min");
  const earningsMax = searchParams.get("earnings_max");
  const industries = searchParams.get("industries");
  const locationSearch = searchParams.get("location_search");
  const datePreset = searchParams.get("date_added_preset");
  const evaluationStatus = searchParams.get("evaluation_status");

  // Get profile for stale check
  const { data: profile } = await supabase
    .from("profiles")
    .select("buyer_profile_version")
    .eq("id", user.id)
    .single();

  const profileVersion = profile?.buyer_profile_version || 1;

  const { data: activePrompt } = await supabase
    .from("prompt_templates")
    .select("version")
    .eq("is_active", true)
    .single();

  const promptVersion = activePrompt?.version || 1;

  // Build query - get listings with user's evaluations
  let query = supabase
    .from("listings")
    .select(
      `*, evaluations!left(id, fit_score, fit_notes, profile_version, prompt_version, user_rating, user_notes, evaluated_at)`,
      { count: "exact" }
    )
    .eq("evaluations.user_id", user.id);

  // Apply listing filters
  if (priceMin) query = query.gte("asking_price", parseFloat(priceMin));
  if (priceMax) query = query.lte("asking_price", parseFloat(priceMax));
  if (revenueMin) query = query.gte("revenue", parseFloat(revenueMin));
  if (revenueMax) query = query.lte("revenue", parseFloat(revenueMax));
  if (earningsMin) query = query.gte("earnings", parseFloat(earningsMin));
  if (earningsMax) query = query.lte("earnings", parseFloat(earningsMax));
  if (locationSearch) query = query.ilike("location", `%${locationSearch}%`);
  if (industries) {
    const industryList = industries.split(",");
    query = query.in("industry", industryList);
  }

  if (datePreset && datePreset !== "all") {
    const daysMap: Record<string, number> = {
      "1d": 1,
      "3d": 3,
      "1w": 7,
      "1m": 30,
      "3m": 90,
    };
    const days = daysMap[datePreset];
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte("date_added", since.toISOString());
    }
  }

  // Sort
  const validSortKeys = [
    "business_name",
    "location",
    "asking_price",
    "revenue",
    "earnings",
    "margin_pct",
    "multiple",
    "industry",
    "date_added",
    "created_at",
  ];

  // When post-filters (score, evaluation_status) are active, we need all records
  // since filtering happens in memory after the DB query
  const hasPostFilters = scoreMin || scoreMax || sortKey === "fit_score" ||
    (evaluationStatus && evaluationStatus !== "all");

  if (validSortKeys.includes(sortKey)) {
    query = query.order(sortKey, { ascending: sortDir, nullsFirst: false });
  } else {
    query = query.order("date_added", { ascending: false, nullsFirst: false });
  }

  // Only paginate at DB level when there are no post-filters
  if (!hasPostFilters) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);
  }

  const { data: listings, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get last scrape timestamp
  const { data: lastJob } = await supabase
    .from("scrape_jobs")
    .select("completed_at")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  // Transform response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results = (listings || []).map((l: any) => {
    const ev =
      l.evaluations && l.evaluations.length > 0 ? l.evaluations[0] : null;

    const isStale = ev
      ? ev.profile_version < profileVersion ||
        ev.prompt_version < promptVersion
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
  });

  // Post-filter by score and evaluation status (can't do in DB easily with joins)
  if (scoreMin || scoreMax) {
    results = results.filter((r: { evaluation: { fit_score: number } | null }) => {
      if (!r.evaluation) return false;
      const s = r.evaluation.fit_score;
      if (scoreMin && s < parseInt(scoreMin)) return false;
      if (scoreMax && s > parseInt(scoreMax)) return false;
      return true;
    });
  }

  if (evaluationStatus && evaluationStatus !== "all") {
    results = results.filter((r: { evaluation: { is_stale: boolean } | null }) => {
      switch (evaluationStatus) {
        case "scored":
          return r.evaluation != null;
        case "unscored":
          return r.evaluation == null;
        case "stale":
          return r.evaluation?.is_stale === true;
        default:
          return true;
      }
    });
  }

  // Sort by fit_score if requested
  if (sortKey === "fit_score") {
    results.sort((a: { evaluation: { fit_score: number } | null }, b: { evaluation: { fit_score: number } | null }) => {
      const aScore = a.evaluation?.fit_score ?? -1;
      const bScore = b.evaluation?.fit_score ?? -1;
      return sortDir ? aScore - bScore : bScore - aScore;
    });
  }

  // When post-filters are active, paginate in memory
  const effectiveCount = hasPostFilters ? results.length : (count || 0);
  const effectiveTotalPages = Math.ceil(effectiveCount / pageSize);

  if (hasPostFilters) {
    const from = (page - 1) * pageSize;
    results = results.slice(from, from + pageSize);
  }

  return NextResponse.json({
    data: results,
    meta: {
      total_count: effectiveCount,
      page,
      page_size: pageSize,
      total_pages: effectiveTotalPages,
    },
    last_scrape_completed_at: lastJob?.completed_at || null,
  });
}
