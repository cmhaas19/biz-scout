import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = await createServiceClient();

  // Get all profiles
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // Get auth users for email
  const {
    data: { users: authUsers },
  } = await serviceClient.auth.admin.listUsers();

  const emailMap = new Map(
    (authUsers || []).map((u) => [u.id, u.email])
  );

  // Get evaluation counts
  const { data: evalCounts } = await serviceClient.rpc("eval_counts_by_user");
  const countMap = new Map(
    (evalCounts || []).map((r: { user_id: string; count: number }) => [
      r.user_id,
      r.count,
    ])
  );

  const result = (profiles || []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    email: emailMap.get(p.id) || "Unknown",
    role: p.role,
    is_disabled: p.is_disabled,
    kumo_token: !!p.kumo_token,
    buyer_profile_complete:
      p.buyer_profile &&
      (p.buyer_profile.financials ||
        p.buyer_profile.industries?.length ||
        p.buyer_profile.acquisition_target),
    evaluations_count: countMap.get(p.id) || 0,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  return NextResponse.json(result);
}
