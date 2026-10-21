"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Pencil, Send, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOnlineStatus } from "@/utils/useOnlineStatus";

type ForumReaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

type ForumMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_name: string;
  reactions: ForumReaction[];
};

const MAX_MESSAGE_LENGTH = 1000;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "🙌"];

export default function ForumClient() {
  const { data: session } = useSession();
  const isOnline = useOnlineStatus();
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<ForumMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch("/api/forum/messages", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load forum messages.");
      setMessages(result.messages);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load forum messages.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
    const interval = window.setInterval(() => void loadMessages(), 15000);
    return () => window.clearInterval(interval);
  }, [loadMessages]);

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        editingId ? `/api/forum/messages/${editingId}` : "/api/forum/messages",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmedContent }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save your message.");
      setContent("");
      setEditingId(null);
      await loadMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/forum/messages/${messageId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete your message.");
      setMessages((current) => current.filter((message) => message.id !== messageId));
      setMessageToDelete(null);
      toast.success("Message deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete your message.");
    }
  };

  const toggleReaction = async (message: ForumMessage, emoji: string) => {
    const reacted = message.reactions.some((reaction) => reaction.emoji === emoji && reaction.reacted);
    try {
      const response = await fetch(`/api/forum/messages/${message.id}/reactions`, {
        method: reacted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update reaction.");
      await loadMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update reaction.");
    }
  };

  const startEditing = (message: ForumMessage) => {
    setEditingId(message.id);
    setContent(message.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDeleteMessage = () => {
    if (messageToDelete) void deleteMessage(messageToDelete.id);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 shadow-sm sm:p-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Community Forum</h1>
              <p className="text-sm text-muted-foreground">A place to connect with fellow riders.</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Share travel tips, ask questions, and join the conversation. Be kind and keep it helpful.
          </p>
        </section>

        <form onSubmit={submitMessage} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={editingId ? "Edit your message..." : "What would you like to share?"}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={3}
            aria-label="Forum message"
            required
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {content.length}/{MAX_MESSAGE_LENGTH}
            </span>
            <div className="flex gap-2">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setContent("");
                  }}
                >
                  <X className="h-4 w-4" /> Cancel
                </Button>
              )}
              <Button type="submit" disabled={!isOnline || isSubmitting || !content.trim()}>
                <Send className="h-4 w-4" />
                {isSubmitting ? "Saving..." : editingId ? "Save changes" : "Post message"}
              </Button>
            </div>
          </div>
        </form>

        {loadError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p>{loadError}</p>
            <Button variant="link" className="mt-1 h-auto p-0" onClick={() => void loadMessages()}>
              Try again
            </Button>
          </div>
        )}

        <section aria-label="Forum messages" className="space-y-4">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading the conversation...</p>
          ) : messages.length === 0 && !loadError ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Start the conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">Your message will be the first one here.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwner = message.user_id === session?.user?.id;
              const timestamp = new Date(message.created_at);
              return (
                <article key={message.id} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{message.author_name}</p>
                      <time
                        dateTime={message.created_at}
                        className="text-xs text-muted-foreground"
                        title={timestamp.toLocaleString()}
                      >
                        {formatDistanceToNow(timestamp, { addSuffix: true })}
                        {message.updated_at !== message.created_at && " · edited"}
                      </time>
                    </div>
                    {isOwner && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Edit message"
                          disabled={!isOnline}
                          onClick={() => startEditing(message)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete message"
                          disabled={!isOnline}
                          onClick={() => setMessageToDelete(message)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                    {REACTION_EMOJIS.map((emoji) => {
                      const reaction = message.reactions.find((item) => item.emoji === emoji);
                      return (
                        <Button
                          key={emoji}
                          type="button"
                          variant={reaction?.reacted ? "secondary" : "outline"}
                          size="sm"
                          aria-label={`${emoji} reaction${reaction ? `, ${reaction.count}` : ""}`}
                          aria-pressed={reaction?.reacted || false}
                          disabled={!isOnline}
                          onClick={() => void toggleReaction(message, emoji)}
                        >
                          <span aria-hidden="true">{emoji}</span>
                          {reaction?.count ? <span>{reaction.count}</span> : null}
                        </Button>
                      );
                    })}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
      <AlertDialog
        open={Boolean(messageToDelete)}
        onOpenChange={(open) => {
          if (!open) setMessageToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove your message and its reactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep message</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMessage}>Delete message</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
