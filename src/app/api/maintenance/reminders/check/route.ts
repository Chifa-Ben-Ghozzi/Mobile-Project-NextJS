import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";
import { sendImmediateNotification } from "@/lib/pushNotificationService";
import { computeMaintenanceStatus, maintenanceTypeLabel } from "@/lib/maintenance";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: logs, error } = await database
      .collection("vehicle_maintenance")
      .select("*")
      .eq("user_id", session.user.id);
    if (error) throw error;

    const due = (logs ?? [])
      .map((log: any) => ({ ...log, status: computeMaintenanceStatus(log.next_due_at) }))
      .filter((log: any) => log.status === "due_soon" || log.status === "overdue");

    let sent = 0;
    for (const log of due) {
      const label = maintenanceTypeLabel(log.type);
      const title = log.status === "overdue"
        ? `Maintenance overdue: ${label}`
        : `Maintenance due soon: ${label}`;
      const body = `${log.title} — ${log.status === "overdue" ? "overdue" : "due within 14 days"}.`;

      await database.collection("notifications").insert({
        user_id: session.user.id,
        message: `${title}: ${body}`,
        type: "maintenance",
        is_read: false,
        related_id: log.id,
        link: "/profile?tab=vehicles",
      });

      try {
        await sendImmediateNotification(session.user.id, title, body);
      } catch (e) {
        console.error("Push failed for maintenance reminder:", e);
      }
      sent++;
    }

    return NextResponse.json({ sent, total: due.length });
  } catch (error) {
    console.error("Failed to check maintenance reminders:", error);
    return NextResponse.json({ error: "Failed to check reminders." }, { status: 500 });
  }
}
