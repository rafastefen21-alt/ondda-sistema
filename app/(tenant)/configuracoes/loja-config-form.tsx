"use client";

import { useState, useRef } from "react";
import { Palette, ExternalLink, Check, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  slug: string;
  initial: {
    lojaCorPrimaria: string | null;
    lojaBannerUrl: string | null;
    lojaLogoUrl: string | null;
    lojaDescricao: string | null;
  };
}

export function LojaConfigForm({ slug, initial }: Props) {
  const [cor, setCor] = useState(initial.lojaCorPrimaria ?? "#f59e0b");
  const [banner, setBanner] = useState(initial.lojaBannerUrl ?? "");
  const [logo, setLogo] = useState(initial.lojaLogoUrl ?? "");
  const [descricao, setDescricao] = useState(initial.lojaDescricao ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const bannerFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(
    file: File,
    setUploading: (v: boolean) => void,
    setValue: (url: string) => void
  ) {
    setUploadError("");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setUploadError(json.error ?? "Erro ao fazer upload.");
      return;
    }
    const { url } = await res.json();
    setValue(url);
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    setSaved(false);

    const res = await fetch("/api/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lojaCorPrimaria: cor,
        lojaBannerUrl: banner || undefined,
        lojaLogoUrl: logo || undefined,
        lojaDescricao: descricao || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao salvar.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-blue-700" />
          Personalização da Loja Online
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Preview link */}
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-amber-900">Link da sua loja pública</p>
            <p className="font-mono text-xs text-blue-900">
              localhost:3000/loja/{slug}
            </p>
          </div>
          <a
            href={`/loja/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Visualizar
          </a>
        </div>

        {/* Color picker */}
        <div className="space-y-2">
          <Label>Cor principal da loja</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-md border border-gray-300 p-0.5"
            />
            <Input
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              placeholder="#f59e0b"
              className="w-32 font-mono"
              maxLength={7}
            />
            <div
              className="h-10 w-10 flex-shrink-0 rounded-md border border-gray-200 shadow-sm"
              style={{ backgroundColor: cor }}
            />
            <div className="flex gap-2">
              {["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f97316"].map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    cor === c ? "border-gray-700" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Subtitle */}
        <div className="space-y-1.5">
          <Label htmlFor="descricao">Slogan / Descrição</Label>
          <Input
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Produtos fresquinhos, entregues todo dia!"
            maxLength={200}
          />
        </div>

        {/* Banner */}
        <div className="space-y-2">
          <Label>Imagem de capa (banner)</Label>

          {banner ? (
            <div className="relative overflow-hidden rounded-lg border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner}
                alt="Banner"
                className="h-36 w-full object-cover"
                onError={(e) => (e.target as HTMLImageElement).style.display = "none"}
              />
              <button
                type="button"
                onClick={() => { setBanner(""); if (bannerFileRef.current) bannerFileRef.current.value = ""; }}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
              <div className="text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-1 text-xs text-gray-400">Sem capa</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <input
              ref={bannerFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, setUploadingBanner, setBanner);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingBanner}
              onClick={() => bannerFileRef.current?.click()}
              className="w-fit"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingBanner ? "Enviando..." : "Selecionar imagem"}
            </Button>
            <details className="group">
              <summary className="cursor-pointer text-xs text-blue-800 hover:underline list-none">
                Ou cole uma URL
              </summary>
              <Input
                className="mt-1.5"
                type="url"
                value={banner}
                onChange={(e) => setBanner(e.target.value)}
                placeholder="https://..."
              />
            </details>
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <Label>Logotipo</Label>

          {logo ? (
            <div className="relative inline-flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt="Logo"
                className="h-20 w-20 rounded-xl border border-gray-200 object-contain p-1"
                onError={(e) => (e.target as HTMLImageElement).style.display = "none"}
              />
              <button
                type="button"
                onClick={() => { setLogo(""); if (logoFileRef.current) logoFileRef.current.value = ""; }}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
              <ImageIcon className="h-7 w-7 text-gray-300" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <input
              ref={logoFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, setUploadingLogo, setLogo);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingLogo}
              onClick={() => logoFileRef.current?.click()}
              className="w-fit"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingLogo ? "Enviando..." : "Selecionar logo"}
            </Button>
            <details className="group">
              <summary className="cursor-pointer text-xs text-blue-800 hover:underline list-none">
                Ou cole uma URL
              </summary>
              <Input
                className="mt-1.5"
                type="url"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://..."
              />
            </details>
          </div>
        </div>

        {uploadError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {uploadError}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              Salvo!
            </>
          ) : loading ? (
            "Salvando..."
          ) : (
            "Salvar Personalização"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
