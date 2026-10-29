import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getUserContacts } from "@/lib/contactService";
import { supabase } from "@/lib/db";
import { normalizeRideStatus } from "@/lib/rideStatus";
import { isUuid } from "@/lib/uuid";
import { generateETag, isETagMatch } from "@/utils/etag";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !isUuid(session.user.id)) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Surrogate-Control": "no-store",
        },
      });
    }

    const userId = session.user.id;

    const { data: contacts, error: contactsError } = await getUserContacts(userId);

    if (contactsError) throw contactsError;

    // Extract connected user IDs (only for accepted contacts)
    const connectedUserIds = contacts
      .filter((contact) => contact.status === "accepted")
      .map((contact) => (contact.user_id === userId ? contact.contact_id : contact.user_id))
      .filter(isUuid);

    // Fetch active rides and limited history
    const rideConditions = [`requester_id.eq.${userId}`, `accepter_id.eq.${userId}`];
    if (connectedUserIds.length > 0) {
      rideConditions.push(`requester_id.in.(${connectedUserIds.join(",")})`);
    }

    const [ownedRidesResult, openRidesResult] = await Promise.all([
      supabase
        .from("rides")
        .select("*")
        .or(rideConditions.join(","))
        .or("status.eq.pending,status.eq.available,status.eq.accepted,status.in.(completed,cancelled)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("rides")
        .select("*")
        .or("status.eq.pending,status.eq.available")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (ownedRidesResult.error) throw ownedRidesResult.error;
    if (openRidesResult.error) throw openRidesResult.error;

    const rides = Array.from(
      new Map(
        [...ownedRidesResult.data, ...openRidesResult.data].map((ride) => [ride.id, ride])
      ).values()
    )
      .sort((a, b) => new Date(b.created_at || b.time).getTime() - new Date(a.created_at || a.time).getTime())
      .slice(0, 100);

    const requesterIds = Array.from(new Set(rides.map((ride) => ride.requester_id).filter(isUuid)));
    const { data: requesters, error: requestersError } = requesterIds.length
      ? await supabase.from("users").select("id,name").in("id", requesterIds)
      : { data: [], error: null };
    if (requestersError) throw requestersError;
    const requesterNames = new Map(requesters.map((requester) => [requester.id, requester.name]));

    // Generate response data
    const responseData = {
      rides: rides.map((ride) => {
        const fromLocation =
          typeof ride.from_location === "string" && ride.from_location.trim()
            ? ride.from_location
            : ride.origin || "Location unavailable";
        const toLocation =
          typeof ride.to_location === "string" && ride.to_location.trim()
            ? ride.to_location
            : ride.destination || "Location unavailable";

        return normalizeRideStatus({
          ...ride,
          from_location: fromLocation,
          to_location: toLocation,
          requester_name: requesterNames.get(ride.requester_id),
        });
      }),
      contacts,
    };

    // Generate ETag for the response data
    const etag = generateETag(responseData);

    // Check if the client already has this version (ETag match)
    const ifNoneMatch = req.headers.get("if-none-match");
    if (isETagMatch(etag, ifNoneMatch)) {
      // Return 304 Not Modified if the content hasn't changed
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: `"${etag}"`,
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      });
    }

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: `"${etag}"`,
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Dashboard data fetch failed:", error);
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      },
    });
  }
}
