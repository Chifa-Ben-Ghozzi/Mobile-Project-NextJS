import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import {
  driverOfferMigrationMessage,
  isMissingDriverOfferSchema,
  parseDriverOfferInput,
} from "@/lib/driverOffer";
import { isUuid } from "@/lib/uuid";

type RouteProps = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid offer ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = parseDriverOfferInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id,user_id,make_model,year,color,seats,vehicle_type,pet_policy,smoking_policy,accessibility_features")
      .eq("id", parsed.offer.vehicle_id)
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) {
      return NextResponse.json({ error: "Choose one of your active cars." }, { status: 400 });
    }

    const { data: offer, error } = await supabase
      .from("driver_offers")
      .update({ ...parsed.offer, vehicle_snapshot: vehicle })
      .eq("id", id)
      .eq("driver_id", session.user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!offer) return NextResponse.json({ error: "Ride offer not found." }, { status: 404 });
    return NextResponse.json({ offer: { ...offer, driver_name: session.user.name || "Driver" } });
  } catch (error) {
    console.error(`Failed to update driver offer ${id}:`, error);
    if (isMissingDriverOfferSchema(error)) {
      return NextResponse.json({ error: driverOfferMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to update ride offer." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid offer ID." }, { status: 400 });

  try {
    const { data: offer, error } = await supabase
      .from("driver_offers")
      .delete()
      .eq("id", id)
      .eq("driver_id", session.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!offer) return NextResponse.json({ error: "Ride offer not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete driver offer ${id}:`, error);
    if (isMissingDriverOfferSchema(error)) {
      return NextResponse.json({ error: driverOfferMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to delete ride offer." }, { status: 500 });
  }
}
