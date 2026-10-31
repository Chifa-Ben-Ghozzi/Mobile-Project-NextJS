import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { database } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await database.rpc("get_approved_reviews");
  if (error) {
    console.error("Failed to load approved reviews:", error);
    return NextResponse.json({ error: "Failed to load approved reviews" }, { status: 500 });
  }

  return NextResponse.json({ reviews: data ?? [] });
}

export async function POST(request: Request) {
  const { reviewerName, review, rating } = await request.json();
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  const userId = session.user.id;
  if (!userId || !reviewerName || !review || !rating) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const { data, error } = await database
      .collection("reviews")
      .insert({ user_id: userId, reviewer_name: reviewerName, review, rating })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, review: data });
  } catch {
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
