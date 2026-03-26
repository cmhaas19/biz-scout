// ============================================================
// Core domain types for BizScout
// ============================================================

export interface Profile {
  id: string;
  display_name: string | null;
  role: "admin" | "member";
  is_disabled: boolean;
  kumo_token: string | null;
  kumo_token_expires_at: string | null;
  buyer_profile: BuyerProfile | null;
  buyer_profile_version: number;
  kumo_filters: KumoFilters | null;
  created_at: string;
  updated_at: string;
}

export interface BuyerProfile {
  acquisition_target?: string;
  industries?: string[];
  financials?: {
    ebitda_min?: number;
    ebitda_max?: number;
    revenue_min?: number;
    revenue_max?: number;
    max_asking_price?: number;
  };
  geography?: {
    primary?: string;
    secondary?: string;
  };
  business_characteristics?: Array<{
    label: string;
    enabled: boolean;
  }>;
  deal_structure?: string;
  financing?: {
    sba_preapproval?: number;
    liquid_assets?: number;
    equity_contribution_pct_min?: number;
    equity_contribution_pct_max?: number;
  };
  operator_background?: string;
  disqualifying_factors?: string[];
}

export interface KumoFilters {
  price?: [number, number];
  ebitda?: [number, number];
  revenue?: [number, number];
  addedDaysAgo?: string;
  earnings_to_revenue?: [number, number];
  price_to_earnings?: [number, number];
  dealCategoryId?: string[];
  dealSearchableLocationId?: string[];
}

export interface Listing {
  id: string;
  kumo_link: string;
  business_name: string;
  location: string | null;
  asking_price: number | null;
  revenue: number | null;
  earnings: number | null;
  margin_pct: number | null;
  multiple: number | null;
  industry: string | null;
  date_added: string | null;
  summary: string | null;
  top_highlights: string | null;
  additional_information: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  user_id: string;
  listing_id: string;
  fit_score: number;
  fit_notes: string | null;
  profile_version: number;
  prompt_version: number;
  user_rating: "excellent" | "good" | "fair" | "poor" | null;
  user_notes: string | null;
  evaluated_at: string;
  created_at: string;
  updated_at: string;
}

export interface ListingWithEvaluation extends Listing {
  evaluation: {
    fit_score: number | null;
    fit_notes: string | null;
    profile_version: number | null;
    prompt_version: number | null;
    is_stale: boolean;
    user_rating: string | null;
    user_notes: string | null;
    evaluated_at: string | null;
  } | null;
}

export interface ScrapeJob {
  id: string;
  user_id: string | null;
  status: "pending" | "running" | "completed" | "failed";
  trigger: "manual" | "scheduled" | "re-evaluate";
  listings_scraped: number;
  listings_evaluated: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export interface PromptTemplate {
  id: string;
  version: number;
  name: string;
  system_prompt: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  notes: string | null;
}

export interface ListingFilterState {
  score_min?: number;
  score_max?: number;
  price_min?: number;
  price_max?: number;
  revenue_min?: number;
  revenue_max?: number;
  earnings_min?: number;
  earnings_max?: number;
  industries?: string[];
  location_search?: string;
  date_added_preset?: "1d" | "3d" | "1w" | "1m" | "3m" | "all";
  user_ratings?: ("excellent" | "good" | "fair" | "poor" | "unrated")[];
  evaluation_status?: "scored" | "unscored" | "stale" | "all";
  sort_key?: string;
  sort_dir?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface DashboardStats {
  total_listings: number;
  total_evaluated: number;
  stale_count: number;
  last_scrape_completed_at: string | null;
  score_breakdown: {
    strong: number;
    good: number;
    marginal: number;
    weak: number;
    poor: number;
    unscored: number;
  };
  last_scrape: {
    status: string;
    started_at: string | null;
    completed_at: string | null;
    listings_scraped: number;
    listings_evaluated: number;
    trigger: string;
  } | null;
  recent_jobs_found: number;
  top_matches: ListingWithEvaluation[];
}

export interface RateLimitConfig {
  requests: number;
  window_seconds: number;
}
