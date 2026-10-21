import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { isMissingVehicleSchema, parseVehicleInput, vehicleMigrationMessage } from "@/lib/vehicle";

type RouteProps = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = parseVehicleInput(await request.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data: vehicle, error } = await supabase
      .from("vehicles")
      .update(parsed.vehicle)
      .eq("id", id)
      .eq("user_id", session.user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error("Failed to update vehicle:", error);
    if (isMissingVehicleSchema(error)) {
      return NextResponse.json({ error: vehicleMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to update vehicle." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const { data: vehicle, error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete vehicle:", error);
    if (isMissingVehicleSchema(error)) {
      return NextResponse.json({ error: vehicleMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to delete vehicle." }, { status: 500 });
  }
}
