import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";
import { driverOfferMigrationMessage, isMissingDriverOfferSchema } from "@/lib/driverOffer";
import { sendImmediateNotification } from "@/lib/pushNotificationService";
import { isUuid } from "@/lib/uuid";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid offer ID." }, { status: 400 });

  try {
    const { data: offer, error: offerError } = await database
      .collection("driver_offers")
      .select("id,driver_id,from_location,to_location,status,departure_time")
      .eq("id", id)
      .maybeSingle();
    if (offerError) throw offerError;
    if (!offer || offer.status !== "active" || Date.parse(offer.departure_time) <= Date.now()) {
      return NextResponse.json({ error: "This ride offer is no longer available." }, { status: 404 });
    }
    if (offer.driver_id === session.user.id) {
      return NextResponse.json({ error: "You cannot request your own ride offer." }, { status: 400 });
    }

    const { data: existingRequest, error: existingRequestError } = await database
      .collection("driver_offer_requests")
      .select("id")
      .eq("offer_id", id)
      .eq("requester_id", session.user.id)
      .maybeSingle();
    if (existingRequestError) throw existingRequestError;
    if (existingRequest) {
      return NextResponse.json({ error: "You have already requested this ride." }, { status: 409 });
    }

    const { data: rideRequest, error: insertError } = await database
      .collection("driver_offer_requests")
      .insert({
        offer_id: id,
        requester_id: session.user.id,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertError) {
      const errorCode = String(insertError.code || "");
      if (errorCode === "23505" || errorCode === "11000") {
        return NextResponse.json({ error: "You have already requested this ride." }, { status: 409 });
      }
      throw insertError;
    }

    const requesterName = session.user.name || "A passenger";
    const message = `${requesterName} requested your ride offer: ${offer.from_location} to ${offer.to_location}.`;
    const { error: notificationError } = await database.collection("notifications").insert({
      user_id: offer.driver_id,
      message,
      type: "offerRequest",
      related_id: id,
      link: "/offer-ride",
    });
    if (notificationError) {
      const { error: rollbackError } = await database
        .collection("driver_offer_requests")
        .delete()
        .eq("id", rideRequest.id);
      if (rollbackError) console.error("Failed to roll back ride request after notification failure:", rollbackError);
      throw notificationError;
    }

    try {
      await sendImmediateNotification(offer.driver_id, "New ride request", message);
    } catch (error) {
      console.error("Ride request was saved, but push notification delivery failed:", error);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error(`Failed to request driver offer ${id}:`, error);
    if (isMissingDriverOfferSchema(error)) {
      return NextResponse.json({ error: driverOfferMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to request this ride offer." }, { status: 500 });
  }
}
