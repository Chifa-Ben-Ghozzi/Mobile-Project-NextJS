"use client";

import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  role: "assistant" | "user";
  text: string;
};

const suggestedQuestions = [
  "How do I create a ride?",
  "How do I offer a trip?",
  "How do I add a vehicle?",
];

const helpTopics = [
  {
    keywords: ["register", "sign up", "create account", "verification", "verify email"],
    answer:
      "Choose Register and enter your name, email, phone number (including country code), and password. Then open the verification link sent to your email before signing in.",
  },
  {
    keywords: ["create ride", "request ride", "ride request", "passenger", "need a ride"],
    answer:
      "Sign in, choose Create Ride, and enter your route, departure date and time, and ride preferences. Save the request to make it visible to other signed-in users.",
  },
  {
    keywords: ["offer a ride", "offer ride", "driver offer", "publish trip", "driver trip"],
    answer:
      "Choose Offer a Ride to publish a trip as a driver. Add the route, departure time, available places, price, pickup details, and an optional message. Your active offer will be visible to signed-in users.",
  },
  {
    keywords: ["find ride", "browse rides", "see rides", "search rides", "available rides"],
    answer:
      "Open the rides area from the navigation or dashboard to browse open requests and active driver offers. Open a ride to review its details and available actions.",
  },
  {
    keywords: ["accept ride", "join ride", "offer to drive", "respond to ride", "book ride"],
    answer:
      "Open the ride or request and use its available offer or accept action. Check the route and details first; you can track updates from your dashboard and notifications.",
  },
  {
    keywords: ["edit ride", "change ride", "cancel ride", "delete ride"],
    answer:
      "Open the ride from your dashboard and go to its details or edit page. Use the available edit or cancel action. Some changes may not be available after another user has accepted.",
  },
  {
    keywords: ["contact", "add people", "add friend", "invite", "connection"],
    answer:
      "Go to your profile and open Manage Contacts. Search for another user and send a contact request; you can manage requests and contacts there.",
  },
  {
    keywords: ["vehicle", "car", "add car"],
    answer:
      "Open your profile and use the vehicle manager to add or update your saved vehicles. You can select a saved vehicle when creating or editing a ride where vehicle details apply.",
  },
  {
    keywords: ["notification", "push", "alerts"],
    answer:
      "Ride updates appear in the notification panel. To receive browser push notifications, enable them in your profile and allow notifications in your browser. Push delivery also depends on the app's push service being configured.",
  },
  {
    keywords: ["history", "review", "rate"],
    answer:
      "Open Ride History to see past rides. Completed rides may offer an option to leave a review.",
  },
  {
    keywords: ["password", "reset password", "forgot password"],
    answer:
      "On the login page, choose Forgot Password and enter the email address on your account. Follow the reset link sent to your email.",
  },
  {
    keywords: ["map", "location", "address", "route"],
    answer:
      "Use the location fields when creating or editing a ride. If map search is unavailable, check that a map service is configured or enter the location manually.",
  },
];

function getHelpAnswer(question: string): string {
  const normalizedQuestion = question.toLowerCase().replace(/[^\w\s]/g, " ");
  const match = helpTopics
    .map((topic) => ({
      ...topic,
      score: topic.keywords.reduce(
        (score, keyword) =>
          score + (normalizedQuestion.includes(keyword) ? keyword.includes(" ") ? 2 : 1 : 0),
        0
      ),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (match && match.score > 0) {
    return match.answer;
  }

  return "I can help with accounts, rides, driver offers, contacts, vehicles, notifications, and ride history. Try asking about one of those, or browse the FAQ for more help.";
}

export default function HelpChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I'm the RideShare help assistant. Ask me how to use a feature and I'll point you in the right direction.",
    },
  ]);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isOpen]);

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", text: trimmedQuestion },
      { role: "assistant", text: getHelpAnswer(trimmedQuestion) },
    ]);
    setQuestion("");
  }

  function askSuggestedQuestion(suggestedQuestion: string) {
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", text: suggestedQuestion },
      { role: "assistant", text: getHelpAnswer(suggestedQuestion) },
    ]);
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
                <p className="text-xs opacity-90">Here to help you use the app</p>
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
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((suggestedQuestion) => (
                  <button
                    className="rounded-full border px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                    key={suggestedQuestion}
                    onClick={() => askSuggestedQuestion(suggestedQuestion)}
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
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask how to use RideShare..."
                value={question}
              />
              <Button aria-label="Send question" disabled={!question.trim()} size="icon" type="submit">
                <Send aria-hidden="true" />
              </Button>
            </form>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles aria-hidden="true" className="h-3 w-3" />
                Answers are based on the app&apos;s help topics
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
