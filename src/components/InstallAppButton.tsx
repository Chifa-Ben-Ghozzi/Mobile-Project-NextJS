"use client";

import { Download } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface InstallPromptContextValue {
  installPrompt: InstallPromptEvent | null;
  isInstalled: boolean;
  setInstallPrompt: (event: InstallPromptEvent | null) => void;
  setIsInstalled: (installed: boolean) => void;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __rideShareInstallPrompt?: InstallPromptEvent;
  }
}

const InstallPromptContext = createContext<InstallPromptContextValue | null>(null);

export function InstallAppProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const installEvent = event as InstallPromptEvent;
      window.__rideShareInstallPrompt = installEvent;
      setInstallPrompt(installEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      window.__rideShareInstallPrompt = undefined;
    };

    if (window.__rideShareInstallPrompt) {
      setInstallPrompt(window.__rideShareInstallPrompt);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return (
    <InstallPromptContext.Provider
      value={{ installPrompt, isInstalled, setInstallPrompt, setIsInstalled }}
    >
      {children}
    </InstallPromptContext.Provider>
  );
}

export function InstallAppButton() {
  const installContext = useContext(InstallPromptContext);
  if (!installContext) {
    throw new Error("InstallAppButton must be used within InstallAppProvider.");
  }

  const { installPrompt, isInstalled, setInstallPrompt, setIsInstalled } = installContext;

  if (isInstalled) return null;

  const handleInstall = async () => {
    if (!installPrompt) {
      toast.info(
        "To install RideShare, open your browser menu and choose Install app or Add to Home Screen."
      );
      return;
    }

    try {
      window.__rideShareInstallPrompt = undefined;
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      setInstallPrompt(null);

      if (outcome === "accepted") {
        setIsInstalled(true);
        toast.success("RideShare is being installed.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to start the RideShare installation."
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full whitespace-nowrap px-2 sm:px-3"
      onClick={handleInstall}
      aria-label="Install RideShare"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Install app</span>
    </Button>
  );
}
