import { parsePhoneNumber } from "libphonenumber-js";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { getUserContacts } from "@/lib/contactService";
import { supabase } from "@/lib/db";
import { sendImmediateNotification } from "@/lib/pushNotificationService";
import { isMissingRideCriteriaSchema, parseRideCriteria } from "@/lib/rideCriteria";
import { isRideStatusConstraintError, normalizeRideStatus } from "@/lib/rideStatus";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;

    const requester_id = userId;

    const body = await request.json();
    const criteriaResult = parseRideCriteria(body);
    if ("error" in criteriaResult) {
      return NextResponse.json({ error: criteriaResult.error }, { status: 400 });
    }
    const {
      from_location,
      to_location,
      from_lat,
      from_lon,
      to_lat,
      to_lon,
      time,
      rider_name,
      rider_phone,
      note,
    } = body;

    let formattedRiderPhone = rider_phone;
    if (rider_phone) {
      const phoneNumber = parsePhoneNumber(rider_phone);
      if (phoneNumber && phoneNumber.isValid()) {
        formattedRiderPhone = phoneNumber.format("E.164");
      } else {
        formattedRiderPhone = null;
      }
    }

    const rideData = {
      from_location,
      to_location,
      from_lat,
      from_lon,
      to_lat,
      to_lon,
      time,
      requester_id,
      status: "pending",
      rider_name,
      rider_phone: formattedRiderPhone,
      note,
      ...criteriaResult.criteria,
    };

    const legacyRideValues: Record<string, unknown> = {
      driver_id: requester_id,
      origin: from_location,
      destination: to_location,
      departure_time: time,
      available_seats: 3,
      price_per_seat: 0,
    };
    let insertData: Record<string, unknown> = rideData;
    let { data: newRide, error: insertError } = await supabase
      .from("rides")
      .insert(insertData)
      .select()
      .single();

    while (insertError) {
      if (
        insertData.status === "pending" &&
        isRideStatusConstraintError(insertError)
      ) {
        insertData = { ...insertData, status: "available" };
      } else if (insertError.code === "23502") {
        const column = insertError.message.match(/column "([^"]+)"/)?.[1];
        if (!column || !(column in legacyRideValues) || column in insertData) break;
        insertData = { ...insertData, [column]: legacyRideValues[column] };
      } else {
        break;
      }

      ({ data: newRide, error: insertError } = await supabase
        .from("rides")
        .insert(insertData)
        .select()
        .single());
    }

    if (insertError) throw insertError;

    try {
      const { data: contacts, error: contactsError } = await getUserContacts(requester_id);
      if (contactsError) throw contactsError;

      const acceptedContacts = contacts.filter((contact) => contact.status === "accepted");
      const userName = session.user.name || "A contact";

      for (const contact of acceptedContacts) {
        const contactUserId = contact.user_id === userId ? contact.contact_id : contact.user_id;
        const message = `A new ride is available from your contact ${userName} from ${from_location} to ${to_location}`;

        try {
          const { error: notificationError } = await supabase.from("notifications").insert({
            user_id: contactUserId,
            message,
            type: "newRide",
            related_id: newRide.id,
          });
          if (notificationError) throw notificationError;
        } catch (error) {
          console.error(
            `Ride ${newRide.id} created, but notification for ${contactUserId} failed:`,
            error
          );
        }

        try {
          await sendImmediateNotification(contactUserId, "New Ride Available", message);
        } catch (error) {
          console.error(
            `Ride ${newRide.id} created, but push notification for ${contactUserId} failed:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Ride created, but contact notifications could not be processed:", error);
    }

    return NextResponse.json({ ride: normalizeRideStatus(newRide) });
  } catch (error) {
    console.error("Failed to create ride:", error);
    if (isMissingRideCriteriaSchema(error)) {
      return NextResponse.json(
        { error: "Ride criteria are not configured in the database. Apply the latest database.sql migration and try again." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
