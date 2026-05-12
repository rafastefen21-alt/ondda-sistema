"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TenantError]", error?.message, "digest:", error?.digest);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-xl font-bold text-red-700">Erro ao carregar a página</h1>
        <p className="mb-2 text-sm text-gray-600">
          {error?.message || "Ocorreu um erro inesperado."}
        </p>
        {error?.stack && (
          <pre className="mb-4 overflow-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-500 break-all whitespace-pre-wrap max-h-60">
            {error.stack}
          </pre>
        )}
        {error?.digest && (
          <p className="mb-6 rounded-lg bg-gray-100 p-3 font-mono text-xs text-gray-500 break-all">
            digest: {error.digest}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
          >
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}
