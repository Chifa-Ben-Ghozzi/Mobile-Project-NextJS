"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

import AuthLoader from "@/components/AuthLoader";
import DriverOffersPage from "@/components/DriverOffersPage";
import Layout from "@/components/Layout";
import type { User } from "@/types";

export default function OfferRideClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const currentUser = session?.user as User | null;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") return <AuthLoader />;
  if (status === "unauthenticated") return null;
  if (!currentUser) return <div>Error: User not found</div>;

  return (
    <Layout>
      <DriverOffersPage currentUser={currentUser} />
    </Layout>
  );
}
