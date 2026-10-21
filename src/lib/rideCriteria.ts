import type { RideData } from "@/types";

export type RideCriteria = Pick<
  RideData,
  | "passenger_count"
  | "max_price"
  | "luggage_count"
  | "pet_preference"
  | "smoking_preference"
  | "accessibility_needs"
  | "vehicle_type"
  | "gender_preference"
>;

const petPreferences = ["any", "pets_allowed", "no_pets"] as const;
const smokingPreferences = ["any", "non_smoking", "smoking_allowed"] as const;
const vehicleTypes = ["any", "sedan", "suv", "van"] as const;
const genderPreferences = ["any", "female", "male"] as const;

export function parseRideCriteria(value: unknown):
  | { criteria: RideCriteria }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid ride criteria." };
  }

  const input = value as Record<string, unknown>;
  const passengerCount = input.passenger_count ?? 1;
  const maxPrice = input.max_price ?? null;
  const luggageCount = input.luggage_count ?? null;
  const accessibilityNeeds = input.accessibility_needs ?? null;
  const petPreference = input.pet_preference ?? "any";
  const smokingPreference = input.smoking_preference ?? "any";
  const vehicleType = input.vehicle_type ?? "any";
  const genderPreference = input.gender_preference ?? "any";

  if (
    typeof passengerCount !== "number" ||
    !Number.isSafeInteger(passengerCount) ||
    passengerCount < 1
  ) {
    return { error: "Passenger count must be a positive whole number." };
  }
  if (maxPrice !== null && (typeof maxPrice !== "number" || !Number.isFinite(maxPrice) || maxPrice < 0)) {
    return { error: "Maximum price must be a non-negative number." };
  }
  if (
    luggageCount !== null &&
    (typeof luggageCount !== "number" ||
      !Number.isSafeInteger(luggageCount) ||
      luggageCount < 0)
  ) {
    return { error: "Luggage count must be a non-negative whole number." };
  }
  if (
    accessibilityNeeds !== null &&
    (typeof accessibilityNeeds !== "string" || accessibilityNeeds.length > 500)
  ) {
    return { error: "Accessibility needs must be 500 characters or fewer." };
  }
  if (!petPreferences.includes(petPreference as (typeof petPreferences)[number])) {
    return { error: "Invalid pet preference." };
  }
  if (!smokingPreferences.includes(smokingPreference as (typeof smokingPreferences)[number])) {
    return { error: "Invalid smoking preference." };
  }
  if (!vehicleTypes.includes(vehicleType as (typeof vehicleTypes)[number])) {
    return { error: "Invalid vehicle type." };
  }
  if (!genderPreferences.includes(genderPreference as (typeof genderPreferences)[number])) {
    return { error: "Invalid driver gender preference." };
  }

  return {
    criteria: {
      passenger_count: Number(passengerCount),
      max_price: maxPrice === null ? null : Number(maxPrice),
      luggage_count: luggageCount === null ? null : Number(luggageCount),
      pet_preference: petPreference as RideCriteria["pet_preference"],
      smoking_preference: smokingPreference as RideCriteria["smoking_preference"],
      accessibility_needs: accessibilityNeeds as string | null,
      vehicle_type: vehicleType as RideCriteria["vehicle_type"],
      gender_preference: genderPreference as RideCriteria["gender_preference"],
    },
  };
}

export function isMissingRideCriteriaSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; message?: string };
  return (
    (databaseError.code === "PGRST204" || databaseError.code === "42703") &&
    /passenger_count|max_price|luggage_count|pet_preference|smoking_preference|accessibility_needs|vehicle_type|gender_preference/i.test(
      databaseError.message || ""
    )
  );
}
