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

  try {
    // Get the ride details
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (rideError) throw rideError;

    // Check if the user is the accepter
    if (ride.accepter_id !== userId) {
      return NextResponse.json({ error: "You are not the accepter of this ride" }, { status: 403 });
    }

    // Update the ride
    let { data: updatedRide, error: updateError } = await supabase
      .from("rides")
      .update({ accepter_id: null, status: "pending", offered_vehicle: null })
      .eq("id", rideId)
      .select()
      .single();

    if (isRideStatusConstraintError(updateError)) {
      ({ data: updatedRide, error: updateError } = await supabase
        .from("rides")
        .update({ accepter_id: null, status: "available", offered_vehicle: null })
        .eq("id", rideId)
        .select()
        .single());
    }

    if (updateError) throw updateError;

    // Get the accepter's name
    const { data: accepter, error: accepterError } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .single();

    if (accepterError) throw accepterError;

    const message = `${accepter.name} has cancelled their offer for your ride from ${ride.from_location} to ${ride.to_location}`;
    try {
      await sendImmediateNotification(ride.requester_id, "Ride Offer Cancelled", message);
    } catch (notificationError) {
      console.error(`Ride ${rideId} offer was cancelled, but push notification failed:`, notificationError);
    }
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: ride.requester_id,
      message,
      type: "rideCancelled",
      related_id: rideId,
    });

    if (notificationError) {
      console.error(`Ride ${rideId} offer was cancelled, but notification record failed:`, notificationError);
    }

    return NextResponse.json({ ride: normalizeRideStatus(updatedRide) });
  } catch (error) {
    console.error("Failed to cancel ride offer:", error);
    if (isMissingVehicleSchema(error)) {
      return NextResponse.json({ error: vehicleMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
