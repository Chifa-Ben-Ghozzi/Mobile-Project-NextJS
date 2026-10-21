export const forumMigrationMessage =
  "The forum is not configured in the database. Apply the latest database.sql and try again.";

const forumEmojis = ["👍", "❤️", "😂", "🎉", "🙌"] as const;

export function isForumEmoji(value: unknown): value is (typeof forumEmojis)[number] {
  return typeof value === "string" && forumEmojis.some((emoji) => emoji === value);
}

export function parseForumMessage(value: unknown): { content: string } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Invalid message." };
  }
  const input = value as Record<string, unknown>;
  const rawContent = input.content;
  const content = typeof rawContent === "string" ? rawContent.trim() : "";
  if (!content) return { error: "Message cannot be empty." };
  if (content.length > 1000) return { error: "Messages must be 1,000 characters or fewer." };
  return { content };
}

export function isMissingForumSchema(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; message?: string };
  return (
    ["PGRST205", "PGRST204", "42703", "42P01"].includes(databaseError.code || "") &&
    /forum_messages|forum_message_reactions/i.test(databaseError.message || "")
  );
}
