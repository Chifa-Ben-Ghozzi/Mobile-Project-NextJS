import type { Metadata } from "next";

import CreateRideClient from "./client";

export const metadata: Metadata = {
  title: "Request a Ride | RideShare",
  description: "Request a ride to share with your contacts.",
  openGraph: {
    title: "Request a Ride | RideShare",
    description: "Request a ride to share with your contacts.",
  },
};

export default function CreateRide() {
  return <CreateRideClient />;
}
