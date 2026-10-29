import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { forumMigrationMessage, isMissingForumSchema, parseForumMessage } from "@/lib/forum";
import { isUuid } from "@/lib/uuid";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid message ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = parseForumMessage(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from("forum_messages")
      .update({ content: parsed.content, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", session.user.id)
      .select("id,user_id,content,created_at,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Message not found or not yours to edit." }, { status: 404 });
    return NextResponse.json({ message: { ...data, author_name: session.user.name || "RideShare user" } });
  } catch (error) {
    console.error("Failed to update forum message:", error);
    if (isMissingForumSchema(error)) {
      return NextResponse.json({ error: forumMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to update your message." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid message ID." }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from("forum_messages")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Message not found or not yours to delete." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete forum message:", error);
    if (isMissingForumSchema(error)) {
      return NextResponse.json({ error: forumMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to delete your message." }, { status: 500 });
  }
}
