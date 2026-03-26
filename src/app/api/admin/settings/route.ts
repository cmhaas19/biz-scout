import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { bustCache } from "@/lib/settings";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabase.from("system_settings").select("*");

  const result: Record<string, unknown> = {};
  for (const row of data || []) {
    result[row.key] = row.value;
  }

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { settings } = await req.json();
  const serviceClient = await createServiceClient();

  for (const [key, value] of Object.entries(settings)) {
    await serviceClient.from("system_settings").upsert(
      {
        key,
        value: value as object,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "key" }
    );
    bustCache(key);
  }

  return NextResponse.json({ updated: true });
}
