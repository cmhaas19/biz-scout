import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.role !== undefined) {
    // Prevent demoting the last admin
    if (body.role === "member") {
      const serviceClient = await createServiceClient();
      const { count } = await serviceClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last admin" },
          { status: 400 }
        );
      }
    }
    updates.role = body.role;
  }

  if (body.is_disabled !== undefined) {
    // Admins cannot disable themselves
    if (id === user.id) {
      return NextResponse.json(
        { error: "Cannot disable your own account" },
        { status: 400 }
      );
    }
    updates.is_disabled = body.is_disabled;
  }

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("profiles")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: true });
}
