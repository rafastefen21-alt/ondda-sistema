"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorEditarProduto({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[EditarProduto] erro:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="font-semibold text-red-800">Erro ao carregar produto</p>
            <p className="mt-1 text-sm text-red-600">
              {error.message || "Ocorreu um erro inesperado. Tente novamente."}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={reset}>
            Tentar novamente
          </Button>
          <Link href="/produtos">
            <Button size="sm" variant="ghost">
              Voltar para produtos
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
