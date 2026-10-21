"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";

import HelpChatbot from "@/components/HelpChatbot";
import { InstallAppProvider } from "@/components/InstallAppButton";

function OfflineServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch((error: unknown) => {
      console.error("Failed to register offline support:", error);
    });
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <InstallAppProvider>
          <OfflineServiceWorker />
          {children}
          <HelpChatbot />
        </InstallAppProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
