import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";
import { computeMaintenanceStatus } from "@/lib/maintenance";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: logs, error } = await database
      .collection("vehicle_maintenance")
      .select("*")
      .eq("user_id", session.user.id)
      .order("next_due_at", { ascending: true });
    if (error) throw error;

    const reminders = (logs ?? [])
      .map((log: any) => ({ ...log, status: computeMaintenanceStatus(log.next_due_at) }))
      .filter((log: any) => log.status === "due_soon" || log.status === "overdue");

    return NextResponse.json({ reminders });
  } catch (error) {
    console.error("Failed to fetch maintenance reminders:", error);
    return NextResponse.json({ error: "Failed to load reminders." }, { status: 500 });
  }
}
