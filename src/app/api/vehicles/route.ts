import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { isMissingVehicleSchema, parseVehicleInput, vehicleMigrationMessage } from "@/lib/vehicle";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Failed to fetch vehicles:", error);
    if (isMissingVehicleSchema(error)) {
      return NextResponse.json({ error: vehicleMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to load vehicles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseVehicleInput(await request.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data: vehicle, error } = await supabase
      .from("vehicles")
      .insert({ ...parsed.vehicle, user_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error("Failed to create vehicle:", error);
    if (isMissingVehicleSchema(error)) {
      return NextResponse.json({ error: vehicleMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to save vehicle." }, { status: 500 });
  }
}
