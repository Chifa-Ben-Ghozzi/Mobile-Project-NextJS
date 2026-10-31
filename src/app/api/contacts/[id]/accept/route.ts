import { NextResponse } from "next/server";

import { database } from "@/lib/db";
import { sendImmediateNotification } from "@/lib/pushNotificationService";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const contactId = url.pathname.split("/").at(-2);

  try {
    // Get the contact details
    const { data: contact, error: contactError } = await database
      .collection("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError) throw contactError;

    const { data: contactUser, error: contactUserError } = await database
      .collection("users")
      .select("name")
      .eq("id", contact.contact_id)
      .single();

    if (contactUserError) throw contactUserError;

    // Update the contact status
    const { data: updatedContact, error: updateError } = await database
      .collection("contacts")
      .update({ status: "accepted" })
      .eq("id", contactId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Send notification to the requester
    await sendImmediateNotification(
      contact.user_id,
      "Contact Request Accepted",
      `${contactUser.name} has accepted your contact request`
    );

    // Create a notification in the database
    const { error: notificationError } = await database.collection("notifications").insert({
      user_id: contact.user_id,
      message: `${contactUser.name} has accepted your contact request`,
      type: "contactAccepted",
      related_id: contactId,
    });

    if (notificationError) throw notificationError;

    return NextResponse.json({ contact: updatedContact });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
