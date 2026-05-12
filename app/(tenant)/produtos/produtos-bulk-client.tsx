"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, X, CheckCircle, AlertCircle, FileDown, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParsedRow {
  nome: string;
  descricao?: string;
  preco: number;
  unidade: string;
  categoria?: string;
  qtd_minima?: number;
  validade_dias?: number;
  preco_pacote?: number;
  rotulo_pacote?: string;
  preco_caixa?: number;
  rotulo_caixa?: string;
  ncm?: string;
  cfop?: string;
  ativo: boolean;
  _error?: string;
}

const TEMPLATE_HEADERS = [
  "nome", "descricao", "preco", "unidade", "categoria",
  "qtd_minima", "validade_dias",
  "preco_pacote", "rotulo_pacote", "preco_caixa", "rotulo_caixa",
  "ncm", "cfop", "ativo",
];
const TEMPLATE_EXAMPLE = [
  "Pão Francês", "Pão francês tradicional", "0.85", "un", "Pães",
  "1", "",
  "", "", "", "",
  "", "5102", "sim",
];

/**
 * Normaliza um header CSV → chave canônica interna.
 * Usa substituição explícita de caracteres portugueses (não depende de
 * regex de combining chars que pode falhar dependendo do ambiente).
 */
function normalizeHeader(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    // Substituição explícita de letras acentuadas portuguesas
    .replace(/[áàâã]/g, "a")
    .replace(/[éèê]/g, "e")
    .replace(/[íì]/g, "i")
    .replace(/[óòôõ]/g, "o")
    .replace(/[úù]/g, "u")
    .replace(/ç/g, "c")
    .replace(/\s+/g, "_"); // espaços → underline (qtd minima → qtd_minima)

  const ALIASES: Record<string, string> = {
    // status / ativo
    status:            "ativo",
    ativo:             "ativo",
    active:            "ativo",
    situacao:          "ativo",
    // preço
    preco:             "preco",
    preco_venda:       "preco",
    price:             "preco",
    valor:             "preco",
    venda:             "preco",
    // nome
    nome:              "nome",
    name:              "nome",
    produto:           "nome",
    descricao_curta:   "nome",
    // descrição
    descricao:         "descricao",
    description:       "descricao",
    obs:               "descricao",
    // unidade
    unidade:           "unidade",
    unid:              "unidade",
    unit:              "unidade",
    und:               "unidade",
    un:                "unidade",
    // categoria
    categoria:         "categoria",
    category:          "categoria",
    grupo:             "categoria",
    // qtd mínima
    qtd_minima:        "qtd_minima",
    qtd_min:           "qtd_minima",
    quantidade_minima: "qtd_minima",
    minimo:            "qtd_minima",
    // validade
    validade_dias:     "validade_dias",
    validade:          "validade_dias",
    dias_validade:     "validade_dias",
    shelf_life:        "validade_dias",
    // preço pacote
    preco_pacote:      "preco_pacote",
    price_pacote:      "preco_pacote",
    preco_pct:         "preco_pacote",
    valor_pacote:      "preco_pacote",
    // rótulo pacote
    rotulo_pacote:     "rotulo_pacote",
    label_pacote:      "rotulo_pacote",
    embalagem_pacote:  "rotulo_pacote",
    descricao_pacote:  "rotulo_pacote",
    // preço caixa
    preco_caixa:       "preco_caixa",
    price_caixa:       "preco_caixa",
    valor_caixa:       "preco_caixa",
    // rótulo caixa
    rotulo_caixa:      "rotulo_caixa",
    label_caixa:       "rotulo_caixa",
    embalagem_caixa:   "rotulo_caixa",
    descricao_caixa:   "rotulo_caixa",
    // fiscal
    ncm:               "ncm",
    cfop:              "cfop",
  };

  return ALIASES[s] ?? s;
}

/**
 * Converte valor monetário brasileiro para número.
 * Aceita: "R$ 4,40" / "4,40" / "1.234,56" / "4.40" / "0.85"
 */
function parsePrice(raw: string): number {
  // Remove tudo que não seja dígito, vírgula ou ponto
  const stripped = raw.replace(/[^\d.,]/g, "").trim();
  if (!stripped) return NaN;

  const lastComma  = stripped.lastIndexOf(",");
  const lastPeriod = stripped.lastIndexOf(".");

  let normalized: string;
  if (lastComma > lastPeriod) {
    // Vírgula é separador decimal → formato BR (ex: 1.234,56 ou 4,40)
    normalized = stripped.replace(/\./g, "").replace(",", ".");
  } else {
    // Ponto é separador decimal → formato US (ex: 4.40 ou 1,234.56)
    normalized = stripped.replace(/,/g, "");
  }

  return parseFloat(normalized);
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Detecta separador (vírgula ou ponto-e-vírgula)
  const sep = lines[0].includes(";") ? ";" : ",";

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === sep && !inQuote) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  // Normaliza os headers.
  // Alguns CSVs gerados pelo Excel BR colam todos os headers do modelo numa única célula
  // separados por vírgula (ex: "nome,descricao,preco,..."). Nesse caso usamos apenas o
  // primeiro token antes da vírgula para não perder o mapeamento da coluna.
  const normalizedHeaders = splitLine(lines[0]).map((h) => {
    const token = h.includes(",") ? h.split(",")[0] : h;
    return normalizeHeader(token);
  });

  const get = (row: string[], key: string) => {
    const idx = normalizedHeaders.indexOf(key);
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  return lines.slice(1).map((line, i) => {
    const cols = splitLine(line);
    const nome = get(cols, "nome");

    const precoRaw = get(cols, "preco");
    const preco    = parsePrice(precoRaw);

    const ativoRaw = get(cols, "ativo").toLowerCase()
      .replace(/[ãà]/g, "a"); // normaliza "não" → "nao"
    const ativo = ativoRaw !== "inativo"
      && ativoRaw !== "nao"
      && ativoRaw !== "false"
      && ativoRaw !== "0"
      && ativoRaw !== "no";
    // "ativo", "ativo", "sim", "yes", "true", "1", "" → true

    const validade = get(cols, "validade_dias");
    const validadeNum = validade ? parseInt(validade) : undefined;

    const row: ParsedRow = {
      nome,
      descricao:     get(cols, "descricao") || undefined,
      preco:         isNaN(preco) ? 0 : preco,
      unidade:       get(cols, "unidade") || "un",
      categoria:     get(cols, "categoria") || undefined,
      qtd_minima:    (() => { const n = parsePrice(get(cols, "qtd_minima")); return n > 0 ? n : undefined; })(),
      validade_dias: validade && !isNaN(validadeNum!) ? validadeNum : undefined,
      preco_pacote:  (() => { const n = parsePrice(get(cols, "preco_pacote")); return n > 0 ? n : undefined; })(),
      rotulo_pacote: get(cols, "rotulo_pacote") || undefined,
      preco_caixa:   (() => { const n = parsePrice(get(cols, "preco_caixa")); return n > 0 ? n : undefined; })(),
      rotulo_caixa:  get(cols, "rotulo_caixa") || undefined,
      ncm:           get(cols, "ncm") || undefined,
      cfop:          get(cols, "cfop") || undefined,
      ativo,
    };

    if (!row.nome)              row._error = `Linha ${i + 2}: nome obrigatório`;
    else if (isNaN(preco) || preco <= 0)
      row._error = `Linha ${i + 2}: preço inválido ("${precoRaw || "(coluna não encontrada)"}")`;

    return row;
  });
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(","), TEMPLATE_EXAMPLE.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_produtos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ProdutosBulkClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created?: number; errors?: string[]; error?: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    // Tenta UTF-8 primeiro; se houver chars de substituição (arquivo é Windows-1252/Excel BR),
    // relê com a codificação correta.
    const doRead = (encoding: string) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (encoding === "utf-8" && text.includes("�")) {
          doRead("windows-1252");
          return;
        }
        setRows(parseCsv(text));
      };
      reader.readAsText(file, encoding);
    };
    doRead("utf-8");
  }

  async function handleImport() {
    const validRows = rows.filter((r) => !r._error);
    if (!validRows.length) return;
    setImporting(true);
    try {
      const res = await fetch("/api/produtos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRows),
      });
      const data = await res.json().catch(() => ({}));

      // Normaliza a resposta para a forma esperada pela UI
      // API pode retornar:
      //  - sucesso: { created, errors }
      //  - 401/403/400: { error: string | objeto }
      const normalized = {
        created: typeof data.created === "number" ? data.created : 0,
        errors: Array.isArray(data.errors)
          ? data.errors
          : data.error
            ? [typeof data.error === "string" ? data.error : JSON.stringify(data.error)]
            : !res.ok
              ? [`Erro ${res.status}: falha na importação.`]
              : [],
      };

      setResult(normalized);
      if (normalized.created > 0) {
        // Hard reload — mais confiável que router.refresh() após inserção em lote
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setResult({ created: 0, errors: ["Erro de conexão."] });
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/produtos/exportar");
      if (!res.ok) { alert("Erro ao exportar."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "produtos.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const validRows  = rows.filter((r) => !r._error);
  const errorRows  = rows.filter((r) => r._error);

  return (
    <>
      {/* Toolbar buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <FileDown className="h-4 w-4" />
          {exporting ? "Exportando..." : "Exportar CSV"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { reset(); setOpen(true); }}>
          <FileUp className="h-4 w-4" />
          Importar CSV
        </Button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl mx-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Importar produtos em lote</h2>
                <p className="text-sm text-gray-400">Envie um arquivo CSV com os produtos</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1 — Download template */}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <Download className="h-5 w-5 shrink-0 text-blue-700" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900">Baixar modelo CSV</p>
                <p className="text-xs text-blue-600">
                  Colunas: {TEMPLATE_HEADERS.join(", ")}
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
              >
                Baixar modelo
              </button>
            </div>

            {/* Step 2 — Upload */}
            <label
              htmlFor="csv-upload"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 transition hover:border-blue-400 hover:bg-blue-50"
            >
              <Upload className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">
                {fileName ? fileName : "Clique para selecionar o CSV"}
              </p>
              <p className="text-xs text-gray-400">Formatos aceitos: .csv — separado por vírgula ou ponto e vírgula</p>
              <input
                ref={fileRef}
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </label>

            {/* Preview */}
            {rows.length > 0 && !result && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {validRows.length} válido{validRows.length !== 1 ? "s" : ""}
                  </span>
                  {errorRows.length > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                      {errorRows.length} com erro
                    </span>
                  )}
                </div>

                {/* Preview table (first 5) */}
                <div className="overflow-auto rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-left text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Nome</th>
                        <th className="px-3 py-2 font-medium">Preço</th>
                        <th className="px-3 py-2 font-medium">Und.</th>
                        <th className="px-3 py-2 font-medium">Categoria</th>
                        <th className="px-3 py-2 font-medium">Pacote</th>
                        <th className="px-3 py-2 font-medium">Caixa</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.slice(0, 6).map((row, i) => (
                        <tr key={i} className={row._error ? "bg-red-50" : ""}>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.nome || <span className="text-red-400 italic">vazio</span>}</td>
                          <td className="px-3 py-2">
                            {row.preco > 0 ? `R$ ${row.preco.toFixed(2)}` : <span className="text-red-400">inválido</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{row.unidade}</td>
                          <td className="px-3 py-2 text-gray-500">{row.categoria || "—"}</td>
                          <td className="px-3 py-2 text-gray-500">
                            {row.preco_pacote ? `R$ ${row.preco_pacote.toFixed(2)}` : "—"}
                            {row.rotulo_pacote ? <span className="block text-xs text-gray-400">{row.rotulo_pacote}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {row.preco_caixa ? `R$ ${row.preco_caixa.toFixed(2)}` : "—"}
                            {row.rotulo_caixa ? <span className="block text-xs text-gray-400">{row.rotulo_caixa}</span> : null}
                          </td>
                          <td className="px-3 py-2">
                            {row._error
                              ? <span className="text-red-500" title={row._error}>⚠ erro</span>
                              : <span className="text-green-600">✓</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 6 && (
                    <p className="px-3 py-2 text-xs text-gray-400">
                      ... e mais {rows.length - 6} linha{rows.length - 6 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Errors */}
                {errorRows.length > 0 && (
                  <div className="mt-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 space-y-0.5">
                    {errorRows.slice(0, 5).map((r, i) => (
                      <p key={i}>• {r._error}</p>
                    ))}
                    {errorRows.length > 5 && <p>• ... e mais {errorRows.length - 5} erros</p>}
                    <p className="mt-1 font-medium">Apenas as linhas válidas serão importadas.</p>
                  </div>
                )}
              </div>
            )}

            {/* Import result */}
            {result && (() => {
              const created = result.created ?? 0;
              const errors  = result.errors  ?? [];
              return (
                <div className={`mt-4 rounded-xl p-4 ${created > 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <div className="flex items-start gap-2">
                    {created > 0
                      ? <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                      : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    }
                    <div>
                      <p className={`font-semibold text-sm ${created > 0 ? "text-green-800" : "text-red-700"}`}>
                        {created > 0
                          ? `${created} produto${created !== 1 ? "s" : ""} importado${created !== 1 ? "s" : ""} com sucesso!`
                          : "Nenhum produto importado."
                        }
                      </p>
                      {errors.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                          {errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Footer actions */}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                {result ? "Fechar" : "Cancelar"}
              </button>
              {!result && (
                <Button
                  onClick={handleImport}
                  disabled={validRows.length === 0 || importing}
                >
                  {importing ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Importar {validRows.length > 0 ? `${validRows.length} produto${validRows.length !== 1 ? "s" : ""}` : ""}
                    </>
                  )}
                </Button>
              )}
              {result && (result.created ?? 0) > 0 && (
                <Button onClick={() => { reset(); setResult(null); }}>
                  Importar mais
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
