import { NextResponse } from "next/server";

import { supabase } from "@/lib/db";
import { isReclamationStatus } from "@/lib/reclamation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const body: unknown = await request.json();
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid update data" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const { status, admin_notes: adminNotes } = input;
  if (typeof status !== "string" || !isReclamationStatus(status)) {
    return NextResponse.json({ error: "Select a valid status" }, { status: 400 });
  }
  if (adminNotes !== undefined && adminNotes !== null && typeof adminNotes !== "string") {
    return NextResponse.json({ error: "Admin notes must be text" }, { status: 400 });
  }
  if (typeof adminNotes === "string" && adminNotes.length > 5000) {
    return NextResponse.json({ error: "Admin notes cannot exceed 5000 characters" }, { status: 400 });
  }

  const { id } = await params;
  const { data, error } = await supabase
    .from("reclamations")
    .update({
      status,
      admin_notes: typeof adminNotes === "string" ? adminNotes.trim() || null : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to update admin reclamation:", error);
    return NextResponse.json({ error: "Failed to update reclamation" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Reclamation not found" }, { status: 404 });
  }

  return NextResponse.json({ reclamation: data });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("reclamations")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to delete admin reclamation:", error);
    return NextResponse.json({ error: "Failed to delete reclamation" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Reclamation not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
