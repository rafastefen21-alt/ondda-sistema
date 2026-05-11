"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error?.message, "digest:", error?.digest);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          background: "#f9fafb",
          margin: 0,
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #fca5a5",
            borderRadius: 16,
            padding: "32px 40px",
            maxWidth: 520,
            width: "100%",
            boxShadow: "0 4px 24px rgba(0,0,0,.08)",
          }}
        >
          <h1 style={{ color: "#dc2626", fontSize: 20, marginBottom: 8 }}>
            Erro inesperado
          </h1>
          <p style={{ color: "#374151", fontSize: 14, marginBottom: 16 }}>
            {error?.message || "Ocorreu um erro no servidor."}
          </p>
          {error?.digest && (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: "#6b7280",
                background: "#f3f4f6",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 24,
                wordBreak: "break-all",
              }}
            >
              digest: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={reset}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Tentar novamente
            </button>
            <button
              onClick={() => (window.location.href = "/produtos")}
              style={{
                background: "#f3f4f6",
                color: "#374151",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
