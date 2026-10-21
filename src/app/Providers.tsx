"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

import HelpChatbot from "@/components/HelpChatbot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <HelpChatbot />
      </ThemeProvider>
    </SessionProvider>
  );
}
