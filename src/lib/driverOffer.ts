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
  const fromLat = typeof input.from_lat === "number" ? input.from_lat : null;
  const fromLon = typeof input.from_lon === "number" ? input.from_lon : null;
  const toLat = typeof input.to_lat === "number" ? input.to_lat : null;
  const toLon = typeof input.to_lon === "number" ? input.to_lon : null;
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
  if (
    fromLat === null ||
    fromLon === null ||
    toLat === null ||
    toLon === null ||
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLon) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLon) ||
    fromLat === 0 ||
    fromLon === 0 ||
    toLat === 0 ||
    toLon === 0
  ) {
    return { error: "Select both the starting point and destination on the map." };
  }
  if (!Number.isFinite(Date.parse(departureTime))) {
    return { error: "Enter a valid departure date and time." };
  }
  if (
    input.status === "active" &&
    Date.parse(departureTime) <= Date.now()
  ) {
    return { error: "Departure date and time must be in the future." };
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
      from_lat: fromLat,
      from_lon: fromLon,
      to_location: toLocation,
      to_lat: toLat,
      to_lon: toLon,
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

export function validateDriverOfferCapacity(availablePlaces: number, vehicleSeats: number) {
  if (vehicleSeats < 2 || availablePlaces > vehicleSeats - 1) {
    return `Available places cannot exceed the car's ${Math.max(0, vehicleSeats - 1)} passenger seats.`;
  }
  return null;
}

export function isMissingDriverOfferSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; message?: string };
  return (
    (databaseError.code === "PGRST205" ||
      databaseError.code === "PGRST204" ||
      databaseError.code === "42703") &&
    /driver_offers|vehicle_snapshot|available_places|offered_price|from_lat|from_lon|to_lat|to_lon/i.test(
      databaseError.message || ""
    )
  );
}

export const driverOfferMigrationMessage =
  "Driver ride offers are not configured in the database. Apply the latest database.sql migration and try again.";
