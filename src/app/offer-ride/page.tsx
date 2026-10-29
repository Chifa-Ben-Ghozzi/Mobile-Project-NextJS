import type { Metadata } from "next";

import OfferRideClient from "./client";

export const metadata: Metadata = {
  title: "Offer a Ride | RideShare",
  description: "Publish and manage your driver trip offers.",
};

export default function OfferRide() {
  return <OfferRideClient />;
}
