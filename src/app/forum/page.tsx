import type { Metadata } from "next";

import ForumClient from "./ForumClient";

export const metadata: Metadata = {
  title: "Community Forum | RideShare",
  description: "Chat with the RideShare community and share your thoughts.",
};

export default function ForumPage() {
  return <ForumClient />;
}
