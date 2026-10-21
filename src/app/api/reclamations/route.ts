import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { validateReclamationInput } from "@/lib/reclamation";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("reclamations")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch user reclamations:", error);
    return NextResponse.json({ error: "Failed to load reclamations" }, { status: 500 });
  }

  return NextResponse.json({ reclamations: data });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = validateReclamationInput(await request.json());
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  if (validation.value.ride_id) {
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("id")
      .eq("id", validation.value.ride_id)
      .or(`requester_id.eq.${session.user.id},accepter_id.eq.${session.user.id}`)
      .maybeSingle();

    if (rideError) {
      console.error("Failed to verify reclamation ride:", rideError);
      return NextResponse.json({ error: "Could not verify related ride" }, { status: 500 });
    }
    if (!ride) {
      return NextResponse.json(
        { error: "The related ride was not found or is not yours" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("reclamations")
    .insert({ ...validation.value, user_id: session.user.id })
    .select()
    .single();

  if (error) {
    console.error("Failed to create reclamation:", error);
    return NextResponse.json({ error: "Failed to submit reclamation" }, { status: 500 });
  }

  return NextResponse.json({ reclamation: data }, { status: 201 });
}
