import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  const userId = session.user.id;

  let body: { subscription?: unknown; deviceId?: unknown; deviceName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { subscription, deviceId, deviceName } = body;
  if (
    !subscription ||
    typeof subscription !== "object" ||
    typeof deviceId !== "string" ||
    !deviceId
  ) {
    return NextResponse.json(
      { error: "A valid subscription and device ID are required" },
      { status: 400 }
    );
  }

  try {
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        device_id: deviceId,
        subscription,
        device_name: typeof deviceName === "string" ? deviceName : null,
        enabled: true,
        last_used: new Date().toISOString(),
      },
      {
        onConflict: "user_id,device_id",
      }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, enabled: true });
  } catch (error) {
    console.error("Failed to save push subscription:", error);
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  const userId = session.user.id;

  let body: { deviceId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { deviceId } = body;
  if (typeof deviceId !== "string" || !deviceId) {
    return NextResponse.json({ error: "A valid device ID is required" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .match({ user_id: userId, device_id: deviceId });

    if (error?.code === "PGRST205") {
      return NextResponse.json({ success: true, removed: false });
    }
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete push subscription:", error);
    return NextResponse.json({ error: "Failed to delete push subscription" }, { status: 500 });
  }
}
