import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { forumMigrationMessage, isMissingForumSchema, parseForumMessage } from "@/lib/forum";
import { isUuid } from "@/lib/uuid";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: messages, error } = await supabase
      .from("forum_messages")
      .select("id,user_id,content,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const messageIds = messages.map((message) => message.id);
    const userIds = Array.from(new Set(messages.map((message) => message.user_id)));
    const [{ data: users, error: usersError }, { data: reactions, error: reactionsError }] =
      messageIds.length
        ? await Promise.all([
            supabase.from("users").select("id,name").in("id", userIds),
            supabase
              .from("forum_message_reactions")
              .select("message_id,user_id,emoji")
              .in("message_id", messageIds),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];
    if (usersError) throw usersError;
    if (reactionsError) throw reactionsError;

    const userNames = new Map(users.map((user) => [user.id, user.name]));
    const messageReactions = new Map<string, typeof reactions>();
    for (const reaction of reactions) {
      const existing = messageReactions.get(reaction.message_id) || [];
      existing.push(reaction);
      messageReactions.set(reaction.message_id, existing);
    }

    return NextResponse.json({
      messages: messages.map((message) => {
        const reactionsForMessage = messageReactions.get(message.id) || [];
        const counts = new Map<string, number>();
        for (const reaction of reactionsForMessage) {
          counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
        }
        return {
          ...message,
          author_name: userNames.get(message.user_id) || "RideShare user",
          reactions: Array.from(counts, ([emoji, count]) => ({
            emoji,
            count,
            reacted: reactionsForMessage.some(
              (reaction) => reaction.emoji === emoji && reaction.user_id === session.user.id
            ),
          })),
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load forum messages:", error);
    if (isMissingForumSchema(error)) {
      return NextResponse.json({ error: forumMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to load forum messages." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isUuid(session.user.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = parseForumMessage(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data: message, error } = await supabase
      .from("forum_messages")
      .insert({ ...parsed, user_id: session.user.id })
      .select("id,user_id,content,created_at,updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json(
      { message: { ...message, author_name: session.user.name || "RideShare user", reactions: [] } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create forum message:", error);
    if (isMissingForumSchema(error)) {
      return NextResponse.json({ error: forumMigrationMessage }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to publish your message." }, { status: 500 });
  }
}
