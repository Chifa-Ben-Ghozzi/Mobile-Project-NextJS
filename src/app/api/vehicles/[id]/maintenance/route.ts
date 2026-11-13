import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";
import { computeMaintenanceStatus, parseMaintenanceInput } from "@/lib/maintenance";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: vehicleId } = await params;

  try {
    const { data: vehicle, error: vehicleError } = await database
      .collection("vehicles")
      .select("id")
      .eq("id", vehicleId)
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

    const { data: logs, error } = await database
      .collection("vehicle_maintenance")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .eq("user_id", session.user.id)
      .order("performed_at", { ascending: false });
    if (error) throw error;

    const withStatus = (logs ?? []).map((log: any) => ({
      ...log,
      status: computeMaintenanceStatus(log.next_due_at),
    }));

    return NextResponse.json({ maintenance: withStatus });
  } catch (error) {
    console.error("Failed to fetch maintenance logs:", error);
    return NextResponse.json({ error: "Failed to load maintenance logs." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: vehicleId } = await params;

  try {
    const { data: vehicle, error: vehicleError } = await database
      .collection("vehicles")
      .select("id")
      .eq("id", vehicleId)
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

    const parsed = parseMaintenanceInput(await request.json());
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data: log, error } = await database
      .collection("vehicle_maintenance")
      .insert({
        ...parsed.maintenance,
        vehicle_id: vehicleId,
        user_id: session.user.id,
        status: computeMaintenanceStatus(parsed.maintenance.next_due_at),
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ maintenance: log }, { status: 201 });
  } catch (error) {
    console.error("Failed to create maintenance log:", error);
    return NextResponse.json({ error: "Failed to save maintenance log." }, { status: 500 });
  }
}
