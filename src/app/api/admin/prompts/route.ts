import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

  const { data } = await supabase
    .from("prompt_templates")
    .select("*")
    .order("version", { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
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

  const { name, system_prompt, notes } = await req.json();

  if (!name || !system_prompt) {
    return NextResponse.json(
      { error: "Name and system_prompt are required" },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  // Get max version
  const { data: maxRow } = await serviceClient
    .from("prompt_templates")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const newVersion = (maxRow?.version || 0) + 1;

  // Deactivate current active
  await serviceClient
    .from("prompt_templates")
    .update({ is_active: false })
    .eq("is_active", true);

  // Insert new version
  const { data, error } = await serviceClient
    .from("prompt_templates")
    .insert({
      version: newVersion,
      name,
      system_prompt,
      is_active: true,
      created_by: user.id,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
