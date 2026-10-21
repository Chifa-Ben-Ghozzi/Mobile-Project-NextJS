import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { validateReclamationInput } from "@/lib/reclamation";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedPendingReclamation(id: string, userId: string) {
  return supabase
    .from("reclamations")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
}

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = validateReclamationInput(await request.json());
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { id } = await params;
  const { data: existing, error: lookupError } = await getOwnedPendingReclamation(
    id,
    session.user.id
  );
  if (lookupError) {
    console.error("Failed to check reclamation ownership:", lookupError);
    return NextResponse.json({ error: "Could not update reclamation" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json(
      { error: "Reclamation not found or it is no longer editable" },
      { status: 404 }
    );
  }

  const { data: ride, error: rideError } = validation.value.ride_id
    ? await supabase
        .from("rides")
        .select("id")
        .eq("id", validation.value.ride_id)
        .or(`requester_id.eq.${session.user.id},accepter_id.eq.${session.user.id}`)
        .maybeSingle()
    : { data: null, error: null };

  if (rideError) {
    console.error("Failed to verify reclamation ride:", rideError);
    return NextResponse.json({ error: "Could not verify related ride" }, { status: 500 });
  }
  if (validation.value.ride_id && !ride) {
    return NextResponse.json(
      { error: "The related ride was not found or is not yours" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("reclamations")
    .update(validation.value)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to update reclamation:", error);
    return NextResponse.json({ error: "Failed to update reclamation" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Reclamation not found or it is no longer editable" },
      { status: 409 }
    );
  }

  return NextResponse.json({ reclamation: data });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await supabase
    .from("reclamations")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to delete reclamation:", error);
    return NextResponse.json({ error: "Failed to delete reclamation" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Reclamation not found or it is no longer deletable" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
