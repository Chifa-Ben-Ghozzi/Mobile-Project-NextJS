import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";
import {
  driverOfferMigrationMessage,
  isMissingDriverOfferSchema,
  parseDriverOfferInput,
  validateDriverOfferCapacity,
} from "@/lib/driverOffer";
import { isUuid } from "@/lib/uuid";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: offers, error } = await database
      .collection("driver_offers")
      .select("*")
      .or(`status.eq.active,driver_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const { data: myRequests, error: myRequestsError } = await database
      .collection("driver_offer_requests")
      .select("offer_id,status")
      .eq("requester_id", session.user.id);
    if (myRequestsError) throw myRequestsError;
    const myRequestStatuses = new Map(
      myRequests.map((request) => [request.offer_id, request.status])
    );

    const ownedOfferIds = offers
      .filter((offer) => offer.driver_id === session.user.id)
      .map((offer) => offer.id);
    const { data: receivedRequests, error: receivedRequestsError } = ownedOfferIds.length
      ? await database
          .collection("driver_offer_requests")
          .select("id,offer_id,requester_id,status,created_at")
          .in("offer_id", ownedOfferIds)
      : { data: [], error: null };
    if (receivedRequestsError) throw receivedRequestsError;

    const requesterIds = Array.from(
      new Set(receivedRequests.map((request) => request.requester_id).filter(isUuid))
    );
    const { data: requesters, error: requestersError } = requesterIds.length
      ? await database.collection("users").select("id,name").in("id", requesterIds)
      : { data: [], error: null };
    if (requestersError) throw requestersError;
    const requesterNames = new Map(requesters.map((requester) => [requester.id, requester.name]));

    const driverIds = Array.from(new Set(offers.map((offer) => offer.driver_id).filter(isUuid)));
    const { data: drivers, error: driversError } = driverIds.length
      ? await database.collection("users").select("id,name").in("id", driverIds)
      : { data: [], error: null };
    if (driversError) throw driversError;
    const names = new Map(drivers.map((driver) => [driver.id, driver.name]));

    return NextResponse.json({
      offers: offers.map((offer) => ({
        ...offer,
        driver_name: names.get(offer.driver_id) || "Driver",
        requested_by_me: myRequestStatuses.has(offer.id),
        my_request_status: myRequestStatuses.get(offer.id) || null,
        requests:
          offer.driver_id === session.user.id
            ? receivedRequests
                .filter((request) => request.offer_id === offer.id)
                .map((request) => ({
                  ...request,
                  requester_name: requesterNames.get(request.requester_id) || "Passenger",
                }))
            : undefined,
      })),
    });
  } catch (error) {
    console.error("Failed to load driver ride offers:", error);
    if (isMissingDriverOfferSchema(error)) {
      return NextResponse.json({ error: driverOfferMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to load ride offers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = parseDriverOfferInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data: vehicle, error: vehicleError } = await database
      .collection("vehicles")
      .select("id,user_id,make_model,year,color,seats,vehicle_type,pet_policy,smoking_policy,accessibility_features")
      .eq("id", parsed.offer.vehicle_id)
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) {
      return NextResponse.json({ error: "Choose one of your active cars." }, { status: 400 });
    }
    const capacityError = validateDriverOfferCapacity(
      parsed.offer.available_places,
      vehicle.seats
    );
    if (capacityError) return NextResponse.json({ error: capacityError }, { status: 400 });

    const { data: offer, error } = await database
      .collection("driver_offers")
      .insert({
        ...parsed.offer,
        driver_id: session.user.id,
        vehicle_snapshot: vehicle,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(
      { offer: { ...offer, driver_name: session.user.name || "Driver" } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create driver ride offer:", error);
    if (isMissingDriverOfferSchema(error)) {
      return NextResponse.json({ error: driverOfferMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to publish ride offer." }, { status: 500 });
  }
}
