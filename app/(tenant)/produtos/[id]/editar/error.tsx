"use client";

import { useEffect } from "react";

export default function ErrorEditarProduto({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  const retry = unstable_retry ?? reset;

  useEffect(() => {
    console.error("[EditarProduto] erro:", error?.message, error?.stack);
  }, [error]);

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "1.5rem", border: "1px solid #fca5a5", borderRadius: 12, background: "#fff7f7" }}>
      <p style={{ fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>Erro ao carregar produto</p>
      <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 8 }}>
        {error?.message ?? "Erro desconhecido"}
      </p>
      {error?.stack && (
        <pre style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "8px 12px", borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflowY: "auto" }}>
          {error.stack}
        </pre>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {retry && (
          <button onClick={retry} style={{ padding: "6px 16px", borderRadius: 8, background: "#1d4ed8", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>
            Tentar novamente
          </button>
        )}
        <a href="/produtos" style={{ padding: "6px 16px", borderRadius: 8, background: "#f3f4f6", color: "#374151", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Voltar para produtos
        </a>
      </div>
    </div>
  );
}
