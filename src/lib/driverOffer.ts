import { isUuid } from "@/lib/uuid";
import type { DriverOfferInput } from "@/types";

const offerStatuses = ["active", "cancelled", "completed"] as const;

export function parseDriverOfferInput(value: unknown):
  | { offer: DriverOfferInput }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid ride offer." };
  }

  const input = value as Record<string, unknown>;
  const fromLocation = typeof input.from_location === "string" ? input.from_location.trim() : "";
  const toLocation = typeof input.to_location === "string" ? input.to_location.trim() : "";
  const departureTime =
    typeof input.departure_time === "string" ? input.departure_time : "";
  const pickupDetails =
    typeof input.pickup_details === "string" ? input.pickup_details.trim() || null : null;
  const message = typeof input.message === "string" ? input.message.trim() || null : null;

  if (!fromLocation || fromLocation.length > 255) {
    return { error: "Starting location is required and must be 255 characters or fewer." };
  }
  if (!toLocation || toLocation.length > 255) {
    return { error: "Destination is required and must be 255 characters or fewer." };
  }
  if (!Number.isFinite(Date.parse(departureTime))) {
    return { error: "Enter a valid departure date and time." };
  }
  if (
    typeof input.offered_price !== "number" ||
    !Number.isFinite(input.offered_price) ||
    input.offered_price < 0 ||
    input.offered_price > 99999999
  ) {
    return { error: "Price must be a non-negative amount." };
  }
  if (
    typeof input.available_places !== "number" ||
    !Number.isInteger(input.available_places) ||
    input.available_places < 1 ||
    input.available_places > 20
  ) {
    return { error: "Available places must be between 1 and 20." };
  }
  if (!isUuid(input.vehicle_id)) return { error: "Select a valid car." };
  if (pickupDetails && pickupDetails.length > 500) {
    return { error: "Pickup details must be 500 characters or fewer." };
  }
  if (message && message.length > 1000) {
    return { error: "Message must be 1,000 characters or fewer." };
  }
  if (!offerStatuses.includes(input.status as (typeof offerStatuses)[number])) {
    return { error: "Choose a valid offer status." };
  }

  return {
    offer: {
      from_location: fromLocation,
      to_location: toLocation,
      departure_time: new Date(departureTime).toISOString(),
      offered_price: input.offered_price,
      available_places: input.available_places,
      pickup_details: pickupDetails,
      message,
      vehicle_id: input.vehicle_id,
      status: input.status as DriverOfferInput["status"],
    },
  };
}

export function isMissingDriverOfferSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; message?: string };
  return (
    (databaseError.code === "PGRST205" ||
      databaseError.code === "PGRST204" ||
      databaseError.code === "42703") &&
    /driver_offers|vehicle_snapshot|available_places|offered_price/i.test(
      databaseError.message || ""
    )
  );
}

export const driverOfferMigrationMessage =
  "Driver ride offers are not configured in the database. Apply the latest database.sql migration and try again.";
