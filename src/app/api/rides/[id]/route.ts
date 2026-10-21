import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { isUuid } from "@/lib/uuid";

type RouteProps = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rideId } = await params;
  if (!isUuid(rideId)) {
    return NextResponse.json({ error: "Invalid ride announcement ID." }, { status: 400 });
  }

  try {
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("id,requester_id,accepter_id,status")
      .eq("id", rideId)
      .maybeSingle();

    if (rideError) throw rideError;
    if (!ride) return NextResponse.json({ error: "Ride announcement not found." }, { status: 404 });
    if (ride.requester_id !== session.user.id) {
      return NextResponse.json(
        { error: "Only the requester can delete this announcement." },
        { status: 403 }
      );
    }
    if (
      ride.accepter_id ||
      (ride.status !== "pending" &&
        ride.status !== "available" &&
        ride.status !== "cancelled")
    ) {
      return NextResponse.json(
        { error: "Only an unoffered or cancelled ride announcement can be deleted." },
        { status: 409 }
      );
    }

    const { data: deletedRide, error: deleteError } = await supabase
      .from("rides")
      .delete()
      .eq("id", rideId)
      .eq("requester_id", session.user.id)
      .is("accepter_id", null)
      .in("status", ["pending", "available", "cancelled"])
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deletedRide) {
      return NextResponse.json(
        { error: "The announcement changed and can no longer be deleted." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete ride announcement ${rideId}:`, error);
    return NextResponse.json(
      { error: "Failed to delete ride announcement. Please try again." },
      { status: 500 }
    );
  }
}
