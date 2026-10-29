import { NextResponse } from "next/server";

import { supabase } from "@/lib/db";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  let query = supabase
    .from("reclamations")
    .select("*, user:user_id(name,email), ride:ride_id(from_location,to_location,time)")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch admin reclamations:", error);
    return NextResponse.json({ error: "Failed to load reclamations" }, { status: 500 });
  }

  return NextResponse.json({ reclamations: data });
}
