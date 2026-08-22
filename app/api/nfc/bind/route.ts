/**
 * GET    /api/nfc/bind          — list the signed-in user's bound cards
 * POST   /api/nfc/bind          — bind a scanned card to the signed-in user
 * DELETE /api/nfc/bind?tag=...  — unbind a card
 *
 * All writes go through the service role; users can only ever touch
 * rows scoped to their own user_id.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await (service as any)
    .from("nfc_credentials")
    .select("id, nfc_tag_id, label, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cards: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nfcTagId = typeof body.nfc_tag_id === "string" ? body.nfc_tag_id.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : null;

  if (!nfcTagId || nfcTagId.length > 64) {
    return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
  }

  // A card can only be bound to one account at a time.
  const { data: existing } = await (service as any)
    .from("nfc_credentials")
    .select("user_id")
    .eq("nfc_tag_id", nfcTagId)
    .maybeSingle();

  if (existing) {
    if (existing.user_id === user.id) {
      return NextResponse.json({ success: true, alreadyBound: true });
    }
    return NextResponse.json(
      { error: "This card is already linked to another account." },
      { status: 409 }
    );
  }

  const { error } = await (service as any)
    .from("nfc_credentials")
    .insert({ user_id: user.id, nfc_tag_id: nfcTagId, label: label || null });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tag = new URL(request.url).searchParams.get("tag");
  if (!tag) return NextResponse.json({ error: "Missing tag" }, { status: 400 });

  const { error } = await (service as any)
    .from("nfc_credentials")
    .delete()
    .eq("user_id", user.id) // can only unbind own cards
    .eq("nfc_tag_id", tag);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
