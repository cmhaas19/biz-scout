import Anthropic from "@anthropic-ai/sdk";
import type { BuyerProfile, Listing, Evaluation } from "@/types";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/format";

const anthropic = new Anthropic();

interface EvaluationResult {
  score: number;
  notes: string;
}

interface CalibrationExample {
  listing: Listing;
  user_rating: string;
  user_notes: string | null;
}

export function serializeBuyerProfile(profile: BuyerProfile): string {
  const sections: string[] = [];

  if (profile.acquisition_target) {
    sections.push(`## Acquisition Target\n${profile.acquisition_target}`);
  }

  if (profile.industries?.length) {
    sections.push(
      `## Industries of Focus\n${profile.industries.map((i) => `- ${i}`).join("\n")}`
    );
  }

  if (profile.financials) {
    const f = profile.financials;
    const lines: string[] = [];
    if (f.ebitda_min != null || f.ebitda_max != null) {
      lines.push(
        `- EBITDA: ${formatCurrency(f.ebitda_min)} - ${formatCurrency(f.ebitda_max)}`
      );
    }
    if (f.revenue_min != null || f.revenue_max != null) {
      lines.push(
        `- Revenue: ${formatCurrency(f.revenue_min)} - ${formatCurrency(f.revenue_max)}`
      );
    }
    if (f.max_asking_price != null) {
      lines.push(`- Max Asking Price: ${formatCurrency(f.max_asking_price)}`);
    }
    if (lines.length) {
      sections.push(`## Size & Financials\n${lines.join("\n")}`);
    }
  }

  if (profile.geography) {
    const g = profile.geography;
    const lines: string[] = [];
    if (g.primary) lines.push(`- Primary: ${g.primary}`);
    if (g.secondary) lines.push(`- Secondary: ${g.secondary}`);
    if (lines.length) {
      sections.push(`## Geography\n${lines.join("\n")}`);
    }
  }

  if (profile.business_characteristics?.length) {
    const enabled = profile.business_characteristics.filter((c) => c.enabled);
    if (enabled.length) {
      sections.push(
        `## Business Characteristics\n${enabled.map((c) => `- ${c.label}`).join("\n")}`
      );
    }
  }

  if (profile.deal_structure) {
    sections.push(
      `## Deal Structure Preferences\n${profile.deal_structure}`
    );
  }

  if (profile.financing) {
    const f = profile.financing;
    const lines: string[] = [];
    if (f.sba_preapproval != null) {
      lines.push(`- SBA Pre-approval: ${formatCurrency(f.sba_preapproval)}`);
    }
    if (f.liquid_assets != null) {
      lines.push(`- Liquid Assets: ${formatCurrency(f.liquid_assets)}`);
    }
    if (
      f.equity_contribution_pct_min != null ||
      f.equity_contribution_pct_max != null
    ) {
      lines.push(
        `- Equity Contribution: ${f.equity_contribution_pct_min ?? 0}% - ${f.equity_contribution_pct_max ?? 100}%`
      );
    }
    if (lines.length) {
      sections.push(`## Financing Capacity\n${lines.join("\n")}`);
    }
  }

  if (profile.operator_background) {
    sections.push(
      `## Operator Background\n${profile.operator_background}`
    );
  }

  if (profile.disqualifying_factors?.length) {
    sections.push(
      `## Disqualifying Factors\n${profile.disqualifying_factors.map((f) => `- ${f}`).join("\n")}`
    );
  }

  return sections.join("\n\n");
}

export function serializeListing(listing: Listing): string {
  return [
    `Title: ${listing.business_name}`,
    `Location: ${listing.location || "Not listed"}`,
    `Asking Price: ${formatCurrency(listing.asking_price)}`,
    `Revenue: ${formatCurrency(listing.revenue)}`,
    `Earnings (EBITDA/SDE): ${formatCurrency(listing.earnings)}`,
    `Margin: ${listing.margin_pct != null ? formatPercent(listing.margin_pct) : "Not listed"}`,
    `Multiple: ${listing.multiple != null ? formatMultiple(listing.multiple) : "Not listed"}`,
    `Industry: ${listing.industry || "Not listed"}`,
    `Date Added: ${listing.date_added || "Not listed"}`,
    ``,
    `Business Summary: ${listing.summary || "Not provided"}`,
    ``,
    `Highlights: ${listing.top_highlights || "Not provided"}`,
    ``,
    `Additional Information: ${listing.additional_information || "Not provided"}`,
  ].join("\n");
}

function buildUserPrompt(
  buyerProfile: BuyerProfile,
  listing: Listing,
  calibrationExamples: CalibrationExample[]
): string {
  const parts: string[] = [];

  parts.push(`## Buyer Profile\n\n${serializeBuyerProfile(buyerProfile)}`);

  if (calibrationExamples.length > 0) {
    parts.push(
      `## Calibration Examples\n\nThe buyer has rated the following listings. Use these to understand their preferences beyond what the profile states.`
    );
    calibrationExamples.forEach((ex, i) => {
      parts.push(
        `--- Example ${i + 1} ---\n${serializeListing(ex.listing)}\nUser Rating: ${ex.user_rating}${ex.user_notes ? `\nUser Notes: ${ex.user_notes}` : ""}`
      );
    });
  }

  parts.push(
    `## Listing to Evaluate\n\n${serializeListing(listing)}\n\nEvaluate this listing and respond with JSON only.`
  );

  return parts.join("\n\n");
}

function parseEvaluationResponse(text: string): EvaluationResult {
  // Strip markdown code fences
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

  const parsed = JSON.parse(cleaned);
  let score = typeof parsed.score === "number" ? parsed.score : parseInt(parsed.score, 10);
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    notes: parsed.notes || "",
  };
}

export async function evaluateListing(
  systemPrompt: string,
  model: string,
  maxTokens: number,
  buyerProfile: BuyerProfile,
  listing: Listing,
  calibrationExamples: CalibrationExample[]
): Promise<EvaluationResult> {
  const userPrompt = buildUserPrompt(
    buyerProfile,
    listing,
    calibrationExamples
  );

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return parseEvaluationResponse(text);
}

export function selectCalibrationExamples(
  evaluations: (Evaluation & { listing: Listing })[],
  maxExamples: number
): CalibrationExample[] {
  const rated = evaluations.filter((e) => e.user_rating != null);
  if (rated.length === 0) return [];

  // Group by rating
  const buckets: Record<string, (Evaluation & { listing: Listing })[]> = {};
  for (const ev of rated) {
    const r = ev.user_rating!;
    if (!buckets[r]) buckets[r] = [];
    buckets[r].push(ev);
  }

  const bucketCount = Object.keys(buckets).length;
  const perBucket = Math.max(2, Math.ceil(maxExamples / bucketCount));

  const examples: CalibrationExample[] = [];
  for (const [, items] of Object.entries(buckets)) {
    const selected = items.slice(0, perBucket);
    for (const ev of selected) {
      examples.push({
        listing: ev.listing,
        user_rating: ev.user_rating!,
        user_notes: ev.user_notes,
      });
      if (examples.length >= maxExamples) return examples;
    }
  }

  return examples;
}
