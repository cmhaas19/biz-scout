import type { KumoFilters } from "@/types";

const KUMO_SEARCH_URL = "https://api.withkumo.com/api/deals/index";
const KUMO_DETAIL_URL = "https://apiv2.withkumo.com/deals";

interface KumoSearchResponse {
  data: KumoSearchDeal[];
  meta: { total_count: number; total_pages: number };
}

interface KumoSearchDeal {
  id: string;
  attributes: {
    title: string;
    location?: string;
    business_summary?: string;
    top_highlights?: string;
    additional_information?: string;
    added_to_kumo_at?: string;
    tags?: string[];
    calculated_values?: {
      price?: string;
      revenue?: string;
      earnings?: string;
      earnings_to_revenue?: string;
      multiple?: string;
    };
  };
}

interface KumoDetailResponse {
  data?: {
    business_summary?: string;
    top_highlights?: string;
    additional_information?: string;
  };
  business_summary?: string;
  top_highlights?: string;
  additional_information?: string;
}

export interface ScrapedListing {
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
}

const DEFAULT_FILTERS = {
  dealCategoryId: [],
  dealChildIndustryId: [],
  dealListingSourceId: [],
  ebitda: [0, 100000000],
  price: [500000, 7000000],
  revenue: [0, 100000000],
  earnings_to_revenue: [0, 1],
  price_to_revenue: [0, 100],
  price_to_earnings: [0, 100],
  hasRevenue: false,
  hasEarnings: false,
  showHidden: "false",
  showRead: "true",
  addedDaysAgo: "<3",
  addedAfter: null,
  addedBefore: null,
  sourceType: null,
  updatedDaysBefore: "",
  updatedDaysAgo: "",
  quantitativeChanges: "",
  CitySearch: [],
  locationFilterType: "dealSearchableLocationId",
  dealSearchableLocationId: [],
  locationPointTextDescription: "",
  locationPointCoordinates: [],
  locationPointRadius: 50,
  textSearchType: "AdvancedSearch",
  titleAndDescriptionSearch: "",
  ANDSearch: [],
  ORSearch: [],
  NOTSearch: [],
  exclude_stale: false,
};

function buildFilters(
  userFilters: KumoFilters | null
): Record<string, unknown> {
  const f = userFilters || {};
  return {
    ...DEFAULT_FILTERS,
    ...(f.price ? { price: f.price } : {}),
    ...(f.ebitda ? { ebitda: f.ebitda } : {}),
    ...(f.revenue ? { revenue: f.revenue } : {}),
    ...(f.addedDaysAgo ? { addedDaysAgo: f.addedDaysAgo } : {}),
    ...(f.earnings_to_revenue
      ? { earnings_to_revenue: f.earnings_to_revenue }
      : {}),
    ...(f.price_to_earnings
      ? { price_to_earnings: f.price_to_earnings }
      : {}),
    ...(f.dealCategoryId
      ? { dealCategoryId: f.dealCategoryId }
      : {}),
    ...(f.dealSearchableLocationId
      ? { dealSearchableLocationId: f.dealSearchableLocationId }
      : {}),
  };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 401) throw new Error("KUMO_TOKEN_EXPIRED");
    if (res.ok) return res;
    if (res.status >= 500 && i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
      continue;
    }
    throw new Error(`Kumo API error: ${res.status} ${res.statusText}`);
  }
  throw new Error("Kumo API: max retries exceeded");
}

export async function scrapeListings(
  token: string,
  userFilters: KumoFilters | null,
  concurrency: number,
  onProgress?: (scraped: number, total: number) => void
): Promise<ScrapedListing[]> {
  const filters = buildFilters(userFilters);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Step 1: Paginate search results
  let page = 1;
  let totalPages = 1;
  const searchResults: KumoSearchDeal[] = [];

  while (page <= totalPages) {
    const res = await fetchWithRetry(KUMO_SEARCH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ filters, page }),
    });

    const json: KumoSearchResponse = await res.json();
    searchResults.push(...json.data);
    totalPages = json.meta.total_pages;
    page++;
  }

  // Step 2: Fetch details in parallel with concurrency limit
  const listings: ScrapedListing[] = [];
  const queue = [...searchResults];
  let completed = 0;

  async function worker() {
    while (queue.length > 0) {
      const deal = queue.shift()!;
      let summary = deal.attributes.business_summary || null;
      let highlights = deal.attributes.top_highlights || null;
      let additionalInfo = deal.attributes.additional_information || null;

      try {
        const detailRes = await fetchWithRetry(
          `${KUMO_DETAIL_URL}/${deal.id}`,
          { headers }
        );
        const detail: KumoDetailResponse = await detailRes.json();
        const d = detail.data || detail;
        summary = d.business_summary || summary;
        highlights = d.top_highlights || highlights;
        additionalInfo = d.additional_information || additionalInfo;
      } catch (err) {
        if (err instanceof Error && err.message === "KUMO_TOKEN_EXPIRED") {
          throw err;
        }
        // Graceful degradation: keep search data
      }

      const cv = deal.attributes.calculated_values;
      const earningsVal = cv?.earnings ? parseFloat(cv.earnings) : null;
      const revenueVal = cv?.revenue ? parseFloat(cv.revenue) : null;
      const marginPct =
        earningsVal != null && revenueVal != null && revenueVal > 0
          ? (earningsVal / revenueVal) * 100
          : cv?.earnings_to_revenue
            ? parseFloat(cv.earnings_to_revenue) * 100
            : null;

      listings.push({
        id: deal.id,
        kumo_link: `https://app.withkumo.com/deal/${deal.id}`,
        business_name: deal.attributes.title,
        location: deal.attributes.location || null,
        asking_price: cv?.price ? parseFloat(cv.price) : null,
        revenue: revenueVal,
        earnings: earningsVal,
        margin_pct: marginPct,
        multiple: cv?.multiple ? parseFloat(cv.multiple) : null,
        industry: deal.attributes.tags?.[0] || null,
        date_added: deal.attributes.added_to_kumo_at || null,
        summary,
        top_highlights: highlights,
        additional_information: additionalInfo,
      });

      completed++;
      onProgress?.(completed, searchResults.length);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, searchResults.length) },
    () => worker()
  );
  await Promise.all(workers);

  return listings;
}
