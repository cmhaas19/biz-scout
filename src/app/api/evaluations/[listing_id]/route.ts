import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ listing_id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listing_id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.user_rating !== undefined) {
    updates.user_rating = body.user_rating;
  }
  if (body.user_notes !== undefined) {
    updates.user_notes = body.user_notes;
  }

  const { data, error } = await supabase
    .from("evaluations")
    .update(updates)
    .eq("user_id", user.id)
    .eq("listing_id", listing_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
