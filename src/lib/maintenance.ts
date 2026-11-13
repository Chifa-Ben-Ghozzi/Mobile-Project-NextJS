import type { MaintenanceStatus, MaintenanceType, VehicleMaintenanceInput } from "@/types";

export const MAINTENANCE_TYPES: { value: MaintenanceType; label: string; icon: string }[] = [
  { value: "oil_change", label: "Oil change", icon: "🛢️" },
  { value: "tire_rotation", label: "Tire rotation", icon: "🛞" },
  { value: "brake_pads", label: "Brake pads", icon: "🛑" },
  { value: "battery", label: "Battery", icon: "🔋" },
  { value: "inspection", label: "Inspection", icon: "🔍" },
  { value: "insurance", label: "Insurance", icon: "🛡️" },
  { value: "registration", label: "Registration", icon: "📄" },
  { value: "license", label: "License", icon: "🪪" },
  { value: "other", label: "Other", icon: "🔧" },
];

export function maintenanceTypeLabel(type: MaintenanceType): string {
  return MAINTENANCE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function maintenanceTypeIcon(type: MaintenanceType): string {
  return MAINTENANCE_TYPES.find((t) => t.value === type)?.icon ?? "🔧";
}

export function computeMaintenanceStatus(nextDueAt: string | null): MaintenanceStatus {
  if (!nextDueAt) return "ok";
  const due = new Date(nextDueAt);
  if (Number.isNaN(due.getTime())) return "ok";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 14) return "due_soon";
  return "ok";
}

export function parseMaintenanceInput(value: unknown):
  | { maintenance: VehicleMaintenanceInput }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid maintenance details." };
  }

  const input = value as Record<string, unknown>;

  const type = input.type;
  const validTypes = MAINTENANCE_TYPES.map((t) => t.value);
  if (!validTypes.includes(type as MaintenanceType)) {
    return { error: "Choose a valid maintenance type." };
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 120) {
    return { error: "Title is required and must be 120 characters or fewer." };
  }

  const description =
    typeof input.description === "string" ? input.description.trim() || null : null;
  if (description && description.length > 1000) {
    return { error: "Description must be 1000 characters or fewer." };
  }

  const performedAt = typeof input.performed_at === "string" ? input.performed_at.trim() : "";
  if (!performedAt || Number.isNaN(new Date(performedAt).getTime())) {
    return { error: "Performed date is required and must be a valid date." };
  }

  const mileageKm =
    input.mileage_km === "" || input.mileage_km === undefined || input.mileage_km === null
      ? null
      : input.mileage_km;
  if (mileageKm !== null && (typeof mileageKm !== "number" || mileageKm < 0)) {
    return { error: "Mileage must be a non-negative number." };
  }

  const cost =
    input.cost === "" || input.cost === undefined || input.cost === null
      ? null
      : input.cost;
  if (cost !== null && (typeof cost !== "number" || cost < 0)) {
    return { error: "Cost must be a non-negative number." };
  }

  const receiptUrl =
    typeof input.receipt_url === "string" ? input.receipt_url.trim() || null : null;

  const nextDueAt =
    typeof input.next_due_at === "string" && input.next_due_at.trim()
      ? input.next_due_at.trim()
      : null;
  if (nextDueAt && Number.isNaN(new Date(nextDueAt).getTime())) {
    return { error: "Next due date must be a valid date." };
  }

  const nextDueMileage =
    input.next_due_mileage === "" || input.next_due_mileage === undefined || input.next_due_mileage === null
      ? null
      : input.next_due_mileage;
  if (nextDueMileage !== null && (typeof nextDueMileage !== "number" || nextDueMileage < 0)) {
    return { error: "Next due mileage must be a non-negative number." };
  }

  return {
    maintenance: {
      type: type as MaintenanceType,
      title,
      description,
      performed_at: performedAt,
      mileage_km: mileageKm as number | null,
      cost: cost as number | null,
      receipt_url: receiptUrl,
      next_due_at: nextDueAt,
      next_due_mileage: nextDueMileage as number | null,
    },
  };
}
