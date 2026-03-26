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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const serviceClient = await createServiceClient();

  // Deactivate all
  await serviceClient
    .from("prompt_templates")
    .update({ is_active: false })
    .eq("is_active", true);

  // Activate requested version
  await serviceClient
    .from("prompt_templates")
    .update({ is_active: true })
    .eq("id", id);

  return NextResponse.json({ activated: true });
}
