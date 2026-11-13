import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";
import { computeMaintenanceStatus, maintenanceTypeLabel } from "@/lib/maintenance";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const vehicleId = url.searchParams.get("vehicleId");

  try {
    // Fetch maintenance logs
    let q = database.collection("vehicle_maintenance").select("*").eq("user_id", session.user.id);
    if (vehicleId) q = q.eq("vehicle_id", vehicleId);
    const { data: logs, error } = await q.order("performed_at", { ascending: false });
    if (error) throw error;

    // Fetch vehicles for names
    const { data: vehicles } = await database
      .collection("vehicles")
      .select("id, make_model, year, color")
      .eq("user_id", session.user.id);
    const vehicleMap = new Map((vehicles ?? []).map((v: any) => [v.id, v]));

    const rows = (logs ?? []).map((log: any) => ({
      ...log,
      status: computeMaintenanceStatus(log.next_due_at),
      vehicle: vehicleMap.get(log.vehicle_id) ?? null,
    }));

    if (format === "html") {
      const html = buildHtmlReport(rows, vehicleMap);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="maintenance-report.html"`,
        },
      });
    }

    // Default: CSV
    const csv = buildCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="maintenance-history.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export maintenance:", error);
    return NextResponse.json({ error: "Failed to export maintenance history." }, { status: 500 });
  }
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows: any[]): string {
  const header = [
    "Vehicle", "Type", "Title", "Description", "Performed On", "Mileage (km)",
    "Cost", "Next Due Date", "Next Due Mileage", "Status", "Receipt URL", "Notes",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const vehicleName = r.vehicle
      ? `${r.vehicle.make_model}${r.vehicle.year ? ` (${r.vehicle.year})` : ""}`
      : r.vehicle_id;
    lines.push([
      csvEscape(vehicleName),
      csvEscape(maintenanceTypeLabel(r.type)),
      csvEscape(r.title),
      csvEscape(r.description),
      csvEscape(r.performed_at?.slice(0, 10)),
      csvEscape(r.mileage_km),
      csvEscape(r.cost),
      csvEscape(r.next_due_at?.slice(0, 10)),
      csvEscape(r.next_due_mileage),
      csvEscape(r.status),
      csvEscape(r.receipt_url),
      csvEscape(r.description),
    ].join(","));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function buildHtmlReport(rows: any[], vehicleMap: Map<string, any>): string {
  const statusColor = (s: string) =>
    s === "overdue" ? "#dc2626" : s === "due_soon" ? "#d97706" : "#16a34a";
  const statusLabel = (s: string) =>
    s === "overdue" ? "Overdue" : s === "due_soon" ? "Due soon" : "OK";

  const rowsHtml = rows.map((r) => {
    const vehicleName = r.vehicle
      ? `${escapeHtml(r.vehicle.make_model)}${r.vehicle.year ? ` (${r.vehicle.year})` : ""}`
      : escapeHtml(r.vehicle_id);
    return `<tr>
      <td>${vehicleName}</td>
      <td>${escapeHtml(maintenanceTypeLabel(r.type))}</td>
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(r.performed_at?.slice(0, 10) ?? "")}</td>
      <td>${r.mileage_km !== null ? r.mileage_km.toLocaleString() : "—"}</td>
      <td>${r.cost !== null ? r.cost.toFixed(2) : "—"}</td>
      <td>${r.next_due_at ? escapeHtml(r.next_due_at.slice(0, 10)) : "—"}</td>
      <td style="color:${statusColor(r.status)};font-weight:600">${statusLabel(r.status)}</td>
    </tr>`;
  }).join("");

  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Maintenance History Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; color: #1f2937; }
  h1 { color: #059669; margin-bottom: 0.25rem; }
  .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th, td { padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  tr:nth-child(even) { background: #f9fafb; }
  .summary { margin-top: 1.5rem; padding: 1rem; background: #ecfdf5; border-radius: 0.5rem; }
  .print-btn { margin-bottom: 1.5rem; padding: 0.5rem 1rem; background: #059669; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; }
  @media print { .print-btn { display: none; } body { margin: 0.5rem; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  <h1>Maintenance History Report</h1>
  <p class="meta">Generated on ${new Date().toLocaleString()} · ${rows.length} record(s) · Total cost: ${totalCost.toFixed(2)}</p>
  <table>
    <thead>
      <tr>
        <th>Vehicle</th><th>Type</th><th>Title</th><th>Performed On</th>
        <th>Mileage</th><th>Cost</th><th>Next Due</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#9ca3af">No maintenance records.</td></tr>'}
    </tbody>
  </table>
  <div class="summary">
    <strong>Summary:</strong> ${rows.length} maintenance record(s) across ${(vehicleMap as Map<string, any>).size} vehicle(s). Total spent: ${totalCost.toFixed(2)}.
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
