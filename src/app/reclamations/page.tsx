import type { Metadata } from "next";

import ReclamationsClient from "./client";

export const metadata: Metadata = {
  title: "Support | RideShare",
  description: "Get help with a ride, your account, or anything else.",
};

export default function ReclamationsPage() {
  return <ReclamationsClient />;
}
