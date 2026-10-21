export const reclamationCategories = [
  { value: "ride_service", label: "Ride or service issue" },
  { value: "safety", label: "Safety concern" },
  { value: "conduct", label: "Driver or passenger conduct" },
  { value: "account", label: "Account or profile issue" },
  { value: "payment", label: "Payment or price issue" },
  { value: "other", label: "Other" },
] as const;

export const reclamationStatuses = ["pending", "in_review", "resolved", "rejected"] as const;

export type ReclamationCategory = (typeof reclamationCategories)[number]["value"];
export type ReclamationStatus = (typeof reclamationStatuses)[number];

export function isReclamationCategory(value: string): value is ReclamationCategory {
  return reclamationCategories.some((category) => category.value === value);
}

export function isReclamationStatus(value: string): value is ReclamationStatus {
  return reclamationStatuses.some((status) => status === value);
}

export interface ReclamationInput {
  category: ReclamationCategory;
  subject: string;
  description: string;
  ride_id: string | null;
}

export function validateReclamationInput(input: unknown):
  | { valid: true; value: ReclamationInput }
  | { valid: false; error: string } {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Invalid reclamation data" };
  }

  const data = input as Record<string, unknown>;
  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const category = data.category;
  const rideId = data.ride_id;

  if (typeof category !== "string" || !isReclamationCategory(category)) {
    return { valid: false, error: "Select a valid reclamation category" };
  }
  if (subject.length < 5 || subject.length > 120) {
    return { valid: false, error: "Subject must be between 5 and 120 characters" };
  }
  if (description.length < 10 || description.length > 5000) {
    return { valid: false, error: "Description must be between 10 and 5000 characters" };
  }
  if (
    rideId !== undefined &&
    rideId !== null &&
    (typeof rideId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rideId))
  ) {
    return { valid: false, error: "Related ride ID is invalid" };
  }

  return {
    valid: true,
    value: {
      category,
      subject,
      description,
      ride_id: typeof rideId === "string" ? rideId : null,
    },
  };
}
