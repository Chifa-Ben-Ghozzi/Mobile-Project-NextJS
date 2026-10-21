type RideWithStatus = {
  status: string;
  accepter_id?: string | null;
};

export function isRideStatusConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23514" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("rides_status_check")
  );
}

export function normalizeRideStatus<T extends RideWithStatus>(ride: T): T {
  if (ride.status !== "available") {
    return ride;
  }

  return {
    ...ride,
    status: ride.accepter_id ? "accepted" : "pending",
  };
}
