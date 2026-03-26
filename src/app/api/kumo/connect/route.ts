import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  // Clean up token - remove "Bearer " prefix if present
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();

  // Try to decode JWT to get expiry
  let expiresAt: string | null = null;
  try {
    const decoded = jwt.decode(cleanToken) as { exp?: number } | null;
    if (decoded?.exp) {
      expiresAt = new Date(decoded.exp * 1000).toISOString();
    }
  } catch {
    // If we can't decode, just store without expiry
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      kumo_token: cleanToken,
      kumo_token_expires_at: expiresAt,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connected: true, expires_at: expiresAt });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("profiles")
    .update({ kumo_token: null, kumo_token_expires_at: null })
    .eq("id", user.id);

  return NextResponse.json({ disconnected: true });
}
