"use client";

import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  role: "assistant" | "user";
  text: string;
};

const suggestedQuestions = [
  "How do I request a ride?",
  "How do I offer a trip?",
  "How do I add a vehicle?",
];

const welcomeMessage: Message = {
  role: "assistant",
  text: "Hi! I'm the RideShare help assistant. Ask me how to use the app and I'll guide you.",
};

export default function HelpChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading, isOpen]);

  async function askQuestion(text: string) {
    const trimmedQuestion = text.trim();
    if (!trimmedQuestion || isLoading) return;

    const conversation = [...messages, { role: "user" as const, text: trimmedQuestion }];
    setMessages(conversation);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.slice(-10).map(({ role, text: messageText }) => ({
            role,
            text: messageText,
          })),
        }),
      });
      const data: { answer?: string; error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The help assistant couldn't respond. Please try again.");
      }
      if (!data.answer) {
        throw new Error("The help assistant returned an empty response. Please try again.");
      }

      const answer = data.answer;
      setMessages((currentMessages) => [...currentMessages, { role: "assistant", text: answer }]);
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "The help assistant couldn't respond. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion(question);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <section
          aria-label="RideShare help chat"
          className="flex h-[min(70vh,34rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-xl sm:w-96"
        >
          <header className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot aria-hidden="true" className="h-5 w-5" />
              <div>
                <h2 className="font-semibold">RideShare Help</h2>
                <p className="text-xs opacity-90">AI-powered help for using the app</p>
              </div>
            </div>
            <Button
              aria-label="Close help chat"
              className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={() => setIsOpen(false)}
              size="icon"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          </header>

          <div
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto p-4"
            ref={messageListRef}
            role="log"
          >
            {messages.map((message, index) => (
              <div
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                key={`${message.role}-${index}`}
              >
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.text}
                </p>
              </div>
            ))}
            {isLoading && (
              <p aria-label="Assistant is responding" className="text-sm text-muted-foreground">
                Thinking...
              </p>
            )}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((suggestedQuestion) => (
                  <button
                    className="rounded-full border px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50"
                    disabled={isLoading}
                    key={suggestedQuestion}
                    onClick={() => void askQuestion(suggestedQuestion)}
                    type="button"
                  >
                    {suggestedQuestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t p-3">
            <form className="flex items-center gap-2" onSubmit={submitQuestion}>
              <Input
                aria-label="Ask a question about using RideShare"
                disabled={isLoading}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask how to use RideShare..."
                value={question}
              />
              <Button
                aria-label="Send question"
                disabled={isLoading || !question.trim()}
                size="icon"
                type="submit"
              >
                <Send aria-hidden="true" />
              </Button>
            </form>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles aria-hidden="true" className="h-3 w-3" />
                AI answers may not always be accurate
              </span>
              <Link className="underline underline-offset-2 hover:text-foreground" href="/faq">
                FAQ
              </Link>
            </div>
          </div>
        </section>
      )}
      <Button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close help chat" : "Open help chat"}
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={() => setIsOpen((open) => !open)}
        size="icon"
      >
        {isOpen ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
      </Button>
    </div>
  );
}
