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
      .order("performed_at", { ascending: false });
    if (error) throw error;

    const { data: vehicles } = await database
      .collection("vehicles")
      .select("id, make_model, year, color")
      .eq("user_id", session.user.id);
    const vehicleMap = new Map((vehicles ?? []).map((v: any) => [v.id, v]));

    const withStatus = (logs ?? []).map((log: any) => ({
      ...log,
      status: computeMaintenanceStatus(log.next_due_at),
      vehicle: vehicleMap.get(log.vehicle_id) ?? null,
    }));

    return NextResponse.json({ maintenance: withStatus });
  } catch (error) {
    console.error("Failed to fetch maintenance logs:", error);
    return NextResponse.json({ error: "Failed to load maintenance logs." }, { status: 500 });
  }
}
