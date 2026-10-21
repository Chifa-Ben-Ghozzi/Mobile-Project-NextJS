import type { VehicleInput } from "@/types";

const vehicleTypes = ["sedan", "suv", "van"] as const;
const petPolicies = ["allowed", "not_allowed"] as const;
const smokingPolicies = ["non_smoking", "smoking_allowed"] as const;

export function parseVehicleInput(value: unknown):
  | { vehicle: VehicleInput }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid vehicle details." };
  }

  const input = value as Record<string, unknown>;
  const makeModel = typeof input.make_model === "string" ? input.make_model.trim() : "";
  const year = input.year === "" || input.year === undefined ? null : input.year;
  if (
    input.color !== undefined &&
    input.color !== null &&
    typeof input.color !== "string"
  ) {
    return { error: "Color must be text." };
  }
  if (
    input.accessibility_features !== undefined &&
    input.accessibility_features !== null &&
    typeof input.accessibility_features !== "string"
  ) {
    return { error: "Accessibility features must be text." };
  }
  const color = typeof input.color === "string" ? input.color.trim() || null : null;
  const seats = input.seats;
  const accessibilityFeatures =
    typeof input.accessibility_features === "string"
      ? input.accessibility_features.trim() || null
      : null;

  if (!makeModel || makeModel.length > 120) {
    return { error: "Make and model are required and must be 120 characters or fewer." };
  }
  if (
    year !== null &&
    (typeof year !== "number" ||
      !Number.isInteger(year) ||
      year < 1950 ||
      year > new Date().getFullYear() + 1)
  ) {
    return { error: "Enter a valid vehicle year." };
  }
  if (color && color.length > 50) return { error: "Color must be 50 characters or fewer." };
  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1 || seats > 20) {
    return { error: "Seat count must be between 1 and 20." };
  }
  if (!vehicleTypes.includes(input.vehicle_type as (typeof vehicleTypes)[number])) {
    return { error: "Choose a valid vehicle type." };
  }
  if (!petPolicies.includes(input.pet_policy as (typeof petPolicies)[number])) {
    return { error: "Choose a valid pet policy." };
  }
  if (!smokingPolicies.includes(input.smoking_policy as (typeof smokingPolicies)[number])) {
    return { error: "Choose a valid smoking policy." };
  }
  if (accessibilityFeatures && accessibilityFeatures.length > 500) {
    return { error: "Accessibility features must be 500 characters or fewer." };
  }
  if (typeof input.is_active !== "boolean") {
    return { error: "Vehicle availability must be specified." };
  }

  return {
    vehicle: {
      make_model: makeModel,
      year: year as number | null,
      color,
      seats,
      vehicle_type: input.vehicle_type as VehicleInput["vehicle_type"],
      pet_policy: input.pet_policy as VehicleInput["pet_policy"],
      smoking_policy: input.smoking_policy as VehicleInput["smoking_policy"],
      accessibility_features: accessibilityFeatures,
      is_active: input.is_active,
    },
  };
}

export function isMissingVehicleSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; message?: string };
  return (
    (databaseError.code === "PGRST205" &&
      /vehicles|offered_vehicle/i.test(databaseError.message || "")) ||
    ((databaseError.code === "PGRST204" || databaseError.code === "42703") &&
      /vehicles|offered_vehicle/i.test(databaseError.message || ""))
  );
}

export const vehicleMigrationMessage =
  "Vehicle management is not configured in the database. Apply the latest database.sql migration and try again.";
