import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { sendImmediateNotification } from "@/lib/pushNotificationService";
import { isRideStatusConstraintError, normalizeRideStatus } from "@/lib/rideStatus";
import { isMissingVehicleSchema, vehicleMigrationMessage } from "@/lib/vehicle";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  const userId = session.user.id;

  const url = new URL(request.url);
  const rideId = url.pathname.split("/").at(-2);
  const body: unknown = await request.json();
  const vehicleId =
    body && typeof body === "object" && "vehicle_id" in body && typeof body.vehicle_id === "string"
      ? body.vehicle_id
      : "";
  if (!vehicleId) {
    return NextResponse.json({ error: "Choose one of your active vehicles to offer this ride." }, { status: 400 });
  }

  try {
    // Get the ride details
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (rideError) throw rideError;

    // Check if the ride is already accepted
    if (ride.accepter_id) {
      return NextResponse.json({ error: "Ride already accepted" }, { status: 400 });
    }

    if (
      ride.requester_id === userId ||
      (ride.status !== "pending" && ride.status !== "available")
    ) {
      return NextResponse.json({ error: "This ride is no longer available to offer." }, { status: 409 });
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select(
        "id,make_model,year,color,seats,vehicle_type,pet_policy,smoking_policy,accessibility_features,is_active"
      )
      .eq("id", vehicleId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) {
      return NextResponse.json({ error: "Select one of your active vehicles." }, { status: 400 });
    }
    const offeredVehicle = {
      id: vehicle.id,
      make_model: vehicle.make_model,
      year: vehicle.year,
      color: vehicle.color,
      seats: vehicle.seats,
      vehicle_type: vehicle.vehicle_type,
      pet_policy: vehicle.pet_policy,
      smoking_policy: vehicle.smoking_policy,
      accessibility_features: vehicle.accessibility_features,
    };

    const { data: accepter, error: accepterError } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .single();
    if (accepterError) throw accepterError;

    // Update the ride
    let { data: updatedRide, error: updateError } = await supabase
      .from("rides")
      .update({ accepter_id: userId, status: "accepted", offered_vehicle: offeredVehicle })
      .eq("id", rideId)
      .is("accepter_id", null)
      .in("status", ["pending", "available"])
      .select()
      .maybeSingle();

    if (isRideStatusConstraintError(updateError)) {
      ({ data: updatedRide, error: updateError } = await supabase
        .from("rides")
        .update({ accepter_id: userId, status: "available", offered_vehicle: offeredVehicle })
        .eq("id", rideId)
        .is("accepter_id", null)
        .in("status", ["pending", "available"])
        .select()
        .maybeSingle());
    }

    if (updateError) throw updateError;
    if (!updatedRide) {
      return NextResponse.json({ error: "This ride was just offered by another driver." }, { status: 409 });
    }

    const notificationMessage = `${accepter.name} offered ${vehicle.make_model} for your ride from ${ride.from_location} to ${ride.to_location}`;
    try {
      await sendImmediateNotification(ride.requester_id, "Ride Accepted", notificationMessage);
    } catch (notificationError) {
      console.error(`Ride ${rideId} was offered, but push notification failed:`, notificationError);
    }
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: ride.requester_id,
      message: notificationMessage,
      type: "rideAccepted",
      related_id: rideId,
    });
    if (notificationError) {
      console.error(`Ride ${rideId} was offered, but notification record failed:`, notificationError);
    }

    return NextResponse.json({ ride: normalizeRideStatus(updatedRide) });
  } catch (error) {
    console.error("Failed to offer ride:", error);
    if (isMissingVehicleSchema(error)) {
      return NextResponse.json({ error: vehicleMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
