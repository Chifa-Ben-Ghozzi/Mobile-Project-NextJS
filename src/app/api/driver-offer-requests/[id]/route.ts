import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";
import { driverOfferMigrationMessage, isMissingDriverOfferSchema } from "@/lib/driverOffer";
import { sendImmediateNotification } from "@/lib/pushNotificationService";
import { isUuid } from "@/lib/uuid";

type RouteProps = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid request ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("decision" in body) ||
    (body.decision !== "accepted" && body.decision !== "declined")
  ) {
    return NextResponse.json({ error: "Choose accept or reject for this request." }, { status: 400 });
  }
  const decision = body.decision;

  try {
    const { data: rideRequest, error: requestError } = await database
      .collection("driver_offer_requests")
      .select("id,offer_id,requester_id,status")
      .eq("id", id)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!rideRequest) return NextResponse.json({ error: "Ride request not found." }, { status: 404 });
    if (rideRequest.status !== "pending") {
      return NextResponse.json({ error: "This ride request has already been decided." }, { status: 409 });
    }

    const { data: offer, error: offerError } = await database
      .collection("driver_offers")
      .select("id,driver_id,from_location,to_location,status,available_places")
      .eq("id", rideRequest.offer_id)
      .maybeSingle();
    if (offerError) throw offerError;
    if (!offer || offer.driver_id !== session.user.id) {
      return NextResponse.json({ error: "You cannot decide this ride request." }, { status: 403 });
    }
    if (offer.status !== "active") {
      return NextResponse.json({ error: "This ride offer is no longer active." }, { status: 409 });
    }
    if (decision === "accepted") {
      const { data: acceptedRequests, error: acceptedRequestsError } = await database
        .collection("driver_offer_requests")
        .select("id")
        .eq("offer_id", offer.id)
        .eq("status", "accepted");
      if (acceptedRequestsError) throw acceptedRequestsError;
      if (acceptedRequests.length >= offer.available_places) {
        return NextResponse.json({ error: "All available places for this ride are filled." }, { status: 409 });
      }
    }

    const { data: updatedRequest, error: updateError } = await database
      .collection("driver_offer_requests")
      .update({ status: decision })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedRequest) {
      return NextResponse.json({ error: "This ride request has already been decided." }, { status: 409 });
    }

    const accepted = decision === "accepted";
    const driverName = session.user.name || "The driver";
    const message = `${driverName} ${accepted ? "accepted" : "rejected"} your request for ${offer.from_location} to ${offer.to_location}.`;
    const notificationType = accepted ? "offerRequestAccepted" : "offerRequestRejected";
    const { error: notificationError } = await database.collection("notifications").insert({
      user_id: rideRequest.requester_id,
      message,
      type: notificationType,
      related_id: offer.id,
      link: "/offer-ride",
    });
    if (notificationError) {
      const { error: rollbackError } = await database
        .collection("driver_offer_requests")
        .update({ status: "pending" })
        .eq("id", id)
        .eq("status", decision);
      if (rollbackError) {
        console.error("Failed to restore ride request after notification failure:", rollbackError);
      }
      throw notificationError;
    }

    try {
      await sendImmediateNotification(
        rideRequest.requester_id,
        accepted ? "Ride request accepted" : "Ride request rejected",
        message
      );
    } catch (error) {
      console.error("Ride request decision was saved, but push notification delivery failed:", error);
    }

    return NextResponse.json({ request: updatedRequest });
  } catch (error) {
    console.error(`Failed to decide ride request ${id}:`, error);
    if (isMissingDriverOfferSchema(error)) {
      return NextResponse.json({ error: driverOfferMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to update this ride request." }, { status: 500 });
  }
}
