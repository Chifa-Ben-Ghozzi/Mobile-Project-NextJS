import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { forumMigrationMessage, isForumEmoji, isMissingForumSchema } from "@/lib/forum";
import { isUuid } from "@/lib/uuid";

type RouteContext = { params: Promise<{ id: string }> };

async function getReactionInput(request: Request) {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const emoji = (body as Record<string, unknown>).emoji;
      if (isForumEmoji(emoji)) return emoji;
    }
  } catch {
    return null;
  }
  return null;
}

async function updateReaction(request: Request, context: RouteContext, remove: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid message ID." }, { status: 400 });
  const emoji = await getReactionInput(request);
  if (!emoji) return NextResponse.json({ error: "Choose a valid reaction." }, { status: 400 });

  try {
    const { data: message, error: messageError } = await supabase
      .from("forum_messages")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });

    const query = remove
      ? supabase
          .from("forum_message_reactions")
          .delete()
          .eq("message_id", id)
          .eq("user_id", session.user.id)
          .eq("emoji", emoji)
      : supabase
          .from("forum_message_reactions")
          .upsert(
            { message_id: id, user_id: session.user.id, emoji },
            { onConflict: "message_id,user_id,emoji", ignoreDuplicates: true }
          );
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update forum reaction:", error);
    if (isMissingForumSchema(error)) {
      return NextResponse.json({ error: forumMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to update reaction." }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  return updateReaction(request, context, false);
}

export async function DELETE(request: Request, context: RouteContext) {
  return updateReaction(request, context, true);
}
