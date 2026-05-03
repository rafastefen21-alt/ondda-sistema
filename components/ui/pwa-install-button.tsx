"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    // Detecta iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    // Detecta se já está instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Captura prompt Android/Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleAndroid() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  }

  if (isInstalled) {
    return (
      <a
        href="/catalogo"
        className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-md"
      >
        ✓ App instalado — Abrir
      </a>
    );
  }

  return (
    <>
      {/* Botão principal */}
      {isIos ? (
        <button
          onClick={() => setShowIosModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-900"
        >
          <Download className="h-4 w-4" />
          Baixar app (iPhone)
        </button>
      ) : installPrompt ? (
        <button
          onClick={handleAndroid}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-900"
        >
          <Download className="h-4 w-4" />
          Baixar app
        </button>
      ) : (
        /* Fallback: navegador não suporta prompt (Firefox, etc.) */
        <a
          href="/catalogo"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-900"
        >
          <Download className="h-4 w-4" />
          Acessar app
        </a>
      )}

      {/* Modal iOS */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-6 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-bold text-slate-900">Instalar no iPhone</p>
              <button onClick={() => setShowIosModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <ol className="space-y-3">
              {[
                { icon: <Share className="h-4 w-4 text-blue-600" />, text: "Toque no botão Compartilhar na barra do Safari" },
                { icon: <span className="text-sm">📋</span>, text: 'Role e toque em "Adicionar à Tela de Início"' },
                { icon: <span className="text-sm">✅</span>, text: 'Toque em "Adicionar" no canto superior direito' },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    {step.icon}
                    {step.text}
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 rounded-xl bg-blue-50 p-3 text-center text-xs text-blue-700">
              O app aparecerá na sua tela inicial como qualquer outro aplicativo.
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
