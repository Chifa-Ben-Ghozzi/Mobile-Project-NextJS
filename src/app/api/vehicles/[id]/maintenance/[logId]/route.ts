import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";
import { computeMaintenanceStatus, parseMaintenanceInput } from "@/lib/maintenance";

type RouteProps = { params: Promise<{ id: string; logId: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: vehicleId, logId } = await params;

  try {
    const { data: log, error } = await database
      .collection("vehicle_maintenance")
      .select("*")
      .eq("id", logId)
      .eq("vehicle_id", vehicleId)
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!log) return NextResponse.json({ error: "Maintenance log not found." }, { status: 404 });

    return NextResponse.json({
      maintenance: { ...log, status: computeMaintenanceStatus(log.next_due_at) },
    });
  } catch (error) {
    console.error("Failed to fetch maintenance log:", error);
    return NextResponse.json({ error: "Failed to load maintenance log." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: vehicleId, logId } = await params;

  const parsed = parseMaintenanceInput(await request.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data: log, error } = await database
      .collection("vehicle_maintenance")
      .update({
        ...parsed.maintenance,
        status: computeMaintenanceStatus(parsed.maintenance.next_due_at),
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId)
      .eq("vehicle_id", vehicleId)
      .eq("user_id", session.user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!log) return NextResponse.json({ error: "Maintenance log not found." }, { status: 404 });

    return NextResponse.json({ maintenance: log });
  } catch (error) {
    console.error("Failed to update maintenance log:", error);
    return NextResponse.json({ error: "Failed to update maintenance log." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: vehicleId, logId } = await params;

  try {
    const { data: log, error } = await database
      .collection("vehicle_maintenance")
      .delete()
      .eq("id", logId)
      .eq("vehicle_id", vehicleId)
      .eq("user_id", session.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!log) return NextResponse.json({ error: "Maintenance log not found." }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete maintenance log:", error);
    return NextResponse.json({ error: "Failed to delete maintenance log." }, { status: 500 });
  }
}
