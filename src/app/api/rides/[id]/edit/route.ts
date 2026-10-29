import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { isMissingRideCriteriaSchema, parseRideCriteria } from "@/lib/rideCriteria";
import { normalizeRideStatus } from "@/lib/rideStatus";
import type { RideData } from "@/types";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const rideId = params.id;
  const body = await request.json();
  const criteriaResult = parseRideCriteria(body);
  if ("error" in criteriaResult) {
    return NextResponse.json({ error: criteriaResult.error }, { status: 400 });
  }
  const updatedRideData: RideData = { ...body, ...criteriaResult.criteria };
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  const userId = session.user.id;
  try {
    // Fetch the current ride data
    const { data: currentRide, error: fetchError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (fetchError) throw fetchError;

    // Check if the user is the requester and the ride is pending
    const isPending =
      currentRide.status === "pending" ||
      (currentRide.status === "available" && !currentRide.accepter_id);
    if (currentRide.requester_id !== userId || !isPending) {
      return NextResponse.json({ error: "Unauthorized or ride is not editable" }, { status: 403 });
    }

    // Update the ride
    const { data: updatedRide, error: updateError } = await supabase
      .from("rides")
      .update({ ...updatedRideData, is_edited: true })
      .eq("id", rideId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ ride: normalizeRideStatus(updatedRide) });
  } catch (error) {
    console.error("Failed to update ride:", error);
    if (isMissingRideCriteriaSchema(error)) {
      return NextResponse.json(
        { error: "Ride criteria are not configured in the database. Apply the latest database.sql migration and try again." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
