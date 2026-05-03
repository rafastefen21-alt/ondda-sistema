"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Registra service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Captura evento de instalação (Android/Chrome/Edge)
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Só mostra se não instalado e usuário não dispensou antes
      const dismissed = localStorage.getItem("pwa_banner_dismissed");
      if (!dismissed && !window.matchMedia("(display-mode: standalone)").matches) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem("pwa_banner_dismissed", "1");
      setShowBanner(false);
    }
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-blue-200 bg-white p-4 shadow-xl">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ondda-logo.png" alt="Ondda" className="h-10 w-10 rounded-xl" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Instalar app Ondda</p>
          <p className="text-xs text-gray-500">Acesse pedidos e catálogo offline</p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem("pwa_banner_dismissed", "1");
            setShowBanner(false);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={handleInstall}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
      >
        <Download className="h-4 w-4" />
        Instalar agora
      </button>
    </div>
  );
}
