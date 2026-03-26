import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/format";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: listings } = await supabase
    .from("listings")
    .select(
      `*, evaluations!left(fit_score, fit_notes, user_rating, user_notes)`
    )
    .eq("evaluations.user_id", user.id)
    .order("date_added", { ascending: false });

  const headers = [
    "Business Name",
    "Location",
    "Asking Price",
    "Revenue",
    "Earnings",
    "Margin %",
    "Multiple",
    "Industry",
    "Date Added",
    "Fit Score",
    "Fit Notes",
    "User Rating",
    "User Notes",
    "Kumo Link",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (listings || []).map((l: any) => {
    const ev = l.evaluations?.[0];
    return [
      l.business_name,
      l.location || "",
      formatCurrency(l.asking_price),
      formatCurrency(l.revenue),
      formatCurrency(l.earnings),
      l.margin_pct != null ? formatPercent(l.margin_pct) : "",
      l.multiple != null ? formatMultiple(l.multiple) : "",
      l.industry || "",
      l.date_added || "",
      ev?.fit_score ?? "",
      ev?.fit_notes || "",
      ev?.user_rating || "",
      ev?.user_notes || "",
      l.kumo_link,
    ];
  });

  function escapeCsv(val: string | number): string {
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row: (string | number)[]) => row.map(escapeCsv).join(",")),
  ].join("\n");

  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="bizscout-listings-${date}.csv"`,
    },
  });
}
