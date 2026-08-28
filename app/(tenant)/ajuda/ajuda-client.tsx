"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  MessageCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  X,
  BookOpen,
  Sparkles,
  ShoppingCart,
  FileText,
  DollarSign,
  Users,
  Settings,
  Factory,
  Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Role } from "@/app/generated/prisma/client";
import {
  IlustracaoDashboard,
  IlustracaoProduto,
  IlustracaoCliente,
  IlustracaoAprovacao,
  IlustracaoProducao,
  IlustracaoNotaFiscal,
  IlustracaoFinanceiro,
  IlustracaoCrm,
  IlustracaoIntegracoes,
} from "./ilustracoes";

/* ── Dados ────────────────────────────────────────────────────────────── */

interface Tutorial {
  id: string;
  categoria: Categoria;
  titulo: string;
  resumo: string;
  ilustracao: ComponentType;
  passos: string[];
  clienteVisivel?: boolean;
}

type Categoria =
  | "Primeiros passos"
  | "Vendas"
  | "Fiscal"
  | "Financeiro"
  | "Relacionamento"
  | "Configuração";

const CATEGORIAS: { nome: Categoria; icon: ComponentType<{ className?: string }>; cor: string }[] = [
  { nome: "Primeiros passos", icon: Sparkles, cor: "text-blue-700 bg-blue-100" },
  { nome: "Vendas", icon: ShoppingCart, cor: "text-indigo-700 bg-indigo-100" },
  { nome: "Fiscal", icon: FileText, cor: "text-purple-700 bg-purple-100" },
  { nome: "Financeiro", icon: DollarSign, cor: "text-green-700 bg-green-100" },
  { nome: "Relacionamento", icon: Users, cor: "text-amber-700 bg-amber-100" },
  { nome: "Configuração", icon: Settings, cor: "text-gray-700 bg-gray-100" },
];

const catMeta = (c: Categoria) => CATEGORIAS.find((x) => x.nome === c)!;

const TUTORIAIS: Tutorial[] = [
  {
    id: "painel",
    categoria: "Primeiros passos",
    titulo: "Conhecendo o painel",
    resumo: "Entenda a tela inicial e os números que aparecem no seu dia a dia.",
    ilustracao: IlustracaoDashboard,
    clienteVisivel: true,
    passos: [
      "No menu lateral, clique em **Dashboard** para voltar à tela inicial a qualquer momento.",
      "No topo, os cartões mostram os números do dia: **pedidos**, **faturamento**, itens **a produzir** e valores **a receber**.",
      "Mais abaixo, acompanhe o **gráfico de vendas** dos últimos dias e a lista dos últimos pedidos recebidos.",
    ],
  },
  {
    id: "produto",
    categoria: "Primeiros passos",
    titulo: "Cadastrar um produto",
    resumo: "Adicione um item ao catálogo para que ele possa ser vendido.",
    ilustracao: IlustracaoProduto,
    passos: [
      "Abra **Produtos** no menu e clique em **+ Novo Produto**.",
      "Preencha **nome**, **categoria**, **preço** e a **unidade** de venda (un, kg, cx...).",
      "Deixe **Produto ativo** ligado para ele aparecer no catálogo dos clientes. Adicione uma foto se quiser.",
      "Clique em **Salvar produto**. Pronto — ele já pode ser vendido.",
    ],
  },
  {
    id: "cliente",
    categoria: "Primeiros passos",
    titulo: "Cadastrar um cliente",
    resumo: "Convide um cliente para acessar o catálogo e fazer pedidos.",
    ilustracao: IlustracaoCliente,
    passos: [
      "Vá em **Clientes** e clique em **+ Novo Cliente**.",
      "Informe **nome / razão social**, **e-mail**, **telefone** e **CNPJ**.",
      "Clique em **Enviar convite**: o cliente recebe um e-mail para acessar o catálogo e comprar.",
    ],
  },
  {
    id: "aprovar",
    categoria: "Vendas",
    titulo: "Aprovar um pedido",
    resumo: "Revise os pedidos que chegam e libere-os para a produção.",
    ilustracao: IlustracaoAprovacao,
    passos: [
      "Pedidos novos aparecem em **Aprovações**. Cada card mostra o cliente, os itens e o valor.",
      "Confira os detalhes e clique em **Aprovar** (ou no **✕** para recusar).",
      "O pedido aprovado entra automaticamente na fila de **Produção**.",
    ],
  },
  {
    id: "producao",
    categoria: "Vendas",
    titulo: "Acompanhar produção e entrega",
    resumo: "Controle cada pedido pelo quadro, da produção até a entrega.",
    ilustracao: IlustracaoProducao,
    passos: [
      "Em **Produção**, os pedidos ficam organizados por etapa no quadro.",
      "Arraste o pedido de **Em Produção** → **Em Entrega** conforme ele avança.",
      "Ao concluir, mova para **Entregue**. O cliente é avisado a cada mudança de etapa.",
    ],
  },
  {
    id: "nota",
    categoria: "Fiscal",
    titulo: "Emitir uma nota fiscal (NF-e)",
    resumo: "Gere a NF-e de um pedido e baixe o DANFE e o XML.",
    ilustracao: IlustracaoNotaFiscal,
    passos: [
      "Abra um pedido **Aprovado** e clique em **Emitir NF-e**. (Configure o certificado/SEFAZ antes — veja *Conectar integrações*.)",
      "A nota é autorizada em segundos; o status aparece na aba **Notas Fiscais**.",
      "Depois de **Autorizada**, use os ícones de ação para baixar o **DANFE (PDF)** e o **XML**.",
    ],
  },
  {
    id: "financeiro",
    categoria: "Financeiro",
    titulo: "Gerar cobranças e boletos",
    resumo: "Emita boletos, acompanhe o que está a receber e o que venceu.",
    ilustracao: IlustracaoFinanceiro,
    passos: [
      "Em **Financeiro** você vê o resumo (a receber, recebido, vencidos) e a lista de cobranças.",
      "Numa cobrança em aberto, clique em **Gerar boleto** para criar o boleto e a linha digitável.",
      "Quando o pagamento cair, a cobrança é marcada como **Pago** automaticamente.",
    ],
  },
  {
    id: "crm",
    categoria: "Relacionamento",
    titulo: "Atender no WhatsApp pelo CRM",
    resumo: "Receba e responda as conversas do WhatsApp dentro do sistema.",
    ilustracao: IlustracaoCrm,
    passos: [
      "As conversas do WhatsApp chegam na coluna de **Leads** do CRM. Um ponto verde indica mensagens não lidas.",
      "Clique no lead para abrir a **conversa completa** no centro da tela.",
      "Escreva sua resposta no campo de mensagem e **envie** — tudo pelo próprio sistema.",
    ],
  },
  {
    id: "integracoes",
    categoria: "Configuração",
    titulo: "Conectar integrações",
    resumo: "Ative Mercado Pago, notas fiscais (SEFAZ) e WhatsApp.",
    ilustracao: IlustracaoIntegracoes,
    passos: [
      "Vá em **Configurações → Integrações**.",
      "Conecte o **Mercado Pago** (pagamentos), o **SEFAZ** (notas fiscais) e o **WhatsApp**. Cada um tem seu botão **Conectar**.",
      "Quando aparecer **Conectado** em verde, a integração está ativa e funcionando.",
    ],
  },
];

const FAQS = [
  {
    question: "O sistema funciona no celular?",
    answer:
      "Sim! O sistema é totalmente responsivo e funciona em qualquer navegador mobile. Para uma experiência ainda melhor, adicione o site à tela inicial do seu celular como um app.",
  },
  {
    question: "Esqueci minha senha, e agora?",
    answer:
      "Na tela de login, clique em 'Esqueci minha senha' e informe seu e-mail. Você receberá um link para criar uma nova senha.",
  },
  {
    question: "Posso ter mais de um usuário na mesma conta?",
    answer:
      "Sim. Em Configurações → Usuários você adiciona operadores e gerentes, cada um com seu próprio acesso e nível de permissão.",
  },
  {
    question: "O cliente consegue fazer pedidos sozinho?",
    answer:
      "Sim. Depois de cadastrado e convidado, o cliente acessa o catálogo online, monta o pedido e envia. Ele chega para você na aba Aprovações.",
  },
  {
    question: "Como funciona a cobrança automática?",
    answer:
      "Ao aprovar um pedido, o sistema pode gerar a cobrança (boleto ou link do Mercado Pago) conforme configurado. Quando o pagamento é confirmado, a cobrança é baixada automaticamente.",
  },
];

/* ── Utilidades ───────────────────────────────────────────────────────── */

/** Renderiza **negrito** e *itálico* simples dentro do texto dos passos. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return (
            <strong key={i} className="font-semibold text-gray-900">
              {p.slice(2, -2)}
            </strong>
          );
        if (p.startsWith("*") && p.endsWith("*"))
          return (
            <em key={i} className="italic text-gray-500">
              {p.slice(1, -1)}
            </em>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/* ── Componente principal ─────────────────────────────────────────────── */

export function AjudaClient({ role }: { role: Role }) {
  const isCliente = role === "CLIENTE";
  const [tab, setTab] = useState<"tutoriais" | "faq">("tutoriais");
  const [filtro, setFiltro] = useState<Categoria | "Todos">("Todos");
  const [aberto, setAberto] = useState<Tutorial | null>(null);

  const tutoriais = TUTORIAIS.filter((t) => (isCliente ? t.clienteVisivel : true));
  const categoriasVisiveis = CATEGORIAS.filter((c) =>
    tutoriais.some((t) => t.categoria === c.nome)
  );
  const lista = tutoriais.filter((t) => filtro === "Todos" || t.categoria === filtro);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Central de Ajuda</h1>
        <p className="text-gray-500">
          Tutoriais passo a passo, perguntas frequentes e suporte da nossa equipe.
        </p>
      </div>

      {/* Suporte */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-800">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Precisa de ajuda personalizada?</p>
              <p className="text-sm text-blue-700">
                Nossa equipe está disponível para te auxiliar via WhatsApp.
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/5511945172652?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20sistema%20Ondda."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com suporte
          </a>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: "tutoriais", label: "Tutoriais", icon: BookOpen },
          { key: "faq", label: "Perguntas frequentes", icon: HelpCircle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as "tutoriais" | "faq")}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === key
                ? "border-blue-800 text-blue-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tutoriais ── */}
      {tab === "tutoriais" && (
        <div className="space-y-5">
          {/* Filtro de categorias */}
          <div className="flex flex-wrap gap-2">
            <FiltroPill
              ativo={filtro === "Todos"}
              onClick={() => setFiltro("Todos")}
              label="Todos"
            />
            {categoriasVisiveis.map((c) => (
              <FiltroPill
                key={c.nome}
                ativo={filtro === c.nome}
                onClick={() => setFiltro(c.nome)}
                label={c.nome}
              />
            ))}
          </div>

          {/* Grade de tutoriais */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((t, i) => {
              const meta = catMeta(t.categoria);
              const Ilustra = t.ilustracao;
              const Icon = meta.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setAberto(t)}
                  className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
                  {/* Miniatura da tela */}
                  <div className="border-b border-gray-100 bg-gray-50 p-3">
                    <div className="overflow-hidden rounded-md ring-1 ring-gray-200">
                      <Ilustra />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <span
                      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cor}`}
                    >
                      <Icon className="h-3 w-3" />
                      {t.categoria}
                    </span>
                    <h3 className="font-semibold text-gray-900">{t.titulo}</h3>
                    <p className="flex-1 text-sm leading-relaxed text-gray-500">{t.resumo}</p>
                    <div className="flex items-center justify-between pt-1 text-sm font-medium text-blue-800">
                      <span className="text-xs text-gray-400">
                        {t.passos.length} passos · nº {i + 1}
                      </span>
                      <span className="inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Ver tutorial
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FAQ ── */}
      {tab === "faq" && (
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <Card key={i}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 select-none">
                  <span className="text-sm font-medium text-gray-900">{faq.question}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <CardContent className="border-t border-gray-100 px-5 pb-4 pt-3">
                  <p className="text-sm leading-relaxed text-gray-600">{faq.answer}</p>
                </CardContent>
              </details>
            </Card>
          ))}
        </div>
      )}

      {/* ── Modal do tutorial ── */}
      {aberto && <TutorialModal tutorial={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

/* ── Subcomponentes ───────────────────────────────────────────────────── */

function FiltroPill({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        ativo
          ? "border-blue-800 bg-blue-800 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
      }`}
    >
      {label}
    </button>
  );
}

function TutorialModal({
  tutorial,
  onClose,
}: {
  tutorial: Tutorial;
  onClose: () => void;
}) {
  const meta = catMeta(tutorial.categoria);
  const Ilustra = tutorial.ilustracao;
  const Icon = meta.icon;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${meta.cor}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{tutorial.titulo}</h2>
              <p className="text-sm text-gray-500">{tutorial.resumo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="grid flex-1 gap-0 overflow-y-auto lg:grid-cols-2">
          {/* Ilustração */}
          <div className="border-b border-gray-100 bg-gray-50 p-4 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-lg shadow-sm ring-1 ring-gray-200 lg:sticky lg:top-0">
              <Ilustra />
            </div>
            <p className="mt-3 text-center text-xs text-gray-400">
              Ilustração da tela · os números indicam cada passo
            </p>
          </div>

          {/* Passos */}
          <div className="p-5">
            <ol className="space-y-4">
              {tutorial.passos.map((passo, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-800 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-sm leading-relaxed text-gray-600">
                    <Rich text={passo} />
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-700" />
              <p className="text-xs leading-relaxed text-blue-800">
                Ficou com dúvida neste passo? Fale com o suporte pelo botão no topo da
                Central de Ajuda.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
