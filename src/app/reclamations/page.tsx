import type { Metadata } from "next";

import ReclamationsClient from "./client";

export const metadata: Metadata = {
  title: "My Reclamations | RideShare",
  description: "Submit and track an issue with RideShare.",
};

export default function ReclamationsPage() {
  return <ReclamationsClient />;
}
