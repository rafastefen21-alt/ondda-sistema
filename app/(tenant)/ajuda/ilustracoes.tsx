/* ────────────────────────────────────────────────────────────────────────
   Ilustrações SVG das telas do sistema — usadas nos tutoriais da Central de
   Ajuda. São componentes puros (sem estado), reproduzindo de forma
   estilizada o layout real: sidebar escura, cabeçalho e área de conteúdo.
   Marcadores numerados (círculos azuis) acompanham os passos de cada tutorial.
   ──────────────────────────────────────────────────────────────────────── */

const C = {
  sidebar: "#111827",
  active: "#1e40af",
  brand: "#1e40af",
  page: "#f9fafb",
  card: "#ffffff",
  border: "#e5e7eb",
  ink: "#111827",
  mut: "#9ca3af",
  soft: "#6b7280",
  line: "#eef2f7",
  green: "#16a34a",
  greenBg: "#dcfce7",
  amber: "#d97706",
  amberBg: "#fef3c7",
  red: "#dc2626",
  redBg: "#fee2e2",
  blueBg: "#dbeafe",
};

const NAV = [
  ["dashboard", "Dashboard"],
  ["pedidos", "Pedidos"],
  ["aprovacoes", "Aprovações"],
  ["producao", "Produção"],
  ["produtos", "Produtos"],
  ["clientes", "Clientes"],
  ["financeiro", "Financeiro"],
  ["notas", "Notas Fiscais"],
  ["crm", "CRM"],
  ["config", "Configurações"],
] as const;

/** Marcador numerado (passo) */
function Step({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={13} fill="#fff" opacity={0.9} />
      <circle cx={x} cy={y} r={11} fill={C.brand} />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#fff"
      >
        {n}
      </text>
    </g>
  );
}

/** Painel branco (card) */
function Panel({
  x,
  y,
  w,
  h,
  r = 8,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}) {
  return (
    <rect x={x} y={y} width={w} height={h} rx={r} fill={C.card} stroke={C.border} />
  );
}

/** Estrutura base: janela + sidebar + cabeçalho + área de conteúdo */
function Shell({
  active,
  title,
  children,
}: {
  active: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 800 500"
      className="h-auto w-full"
      role="img"
      fontFamily="ui-sans-serif, system-ui, sans-serif"
    >
      {/* Moldura da janela */}
      <rect x={0.5} y={0.5} width={799} height={499} rx={14} fill={C.page} stroke={C.border} />

      {/* Sidebar */}
      <path d="M0 14 Q0 0 14 0 H170 V500 H14 Q0 500 0 486 Z" fill={C.sidebar} />
      {/* Logo */}
      <rect x={16} y={15} width={14} height={14} rx={4} fill={C.brand} />
      <text x={38} y={26} fontSize={12} fontWeight={700} fill="#fff">
        Ondda
      </text>
      <line x1={12} y1={44} x2={158} y2={44} stroke="#374151" />
      {/* Itens de navegação */}
      {NAV.map(([key, label], i) => {
        const y = 60 + i * 30;
        const on = key === active;
        return (
          <g key={key}>
            {on && <rect x={10} y={y - 15} width={150} height={26} rx={6} fill={C.active} />}
            <circle cx={24} cy={y - 2} r={3} fill={on ? "#fff" : "#6b7280"} />
            <text
              x={38}
              y={y + 2}
              fontSize={11}
              fontWeight={on ? 700 : 500}
              fill={on ? "#fff" : "#d1d5db"}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Cabeçalho */}
      <rect x={170} y={0} width={630} height={46} fill={C.card} />
      <line x1={170} y1={46} x2={800} y2={46} stroke={C.border} />
      <text x={190} y={29} fontSize={14} fontWeight={700} fill={C.ink}>
        {title}
      </text>
      <circle cx={775} cy={23} r={11} fill={C.line} />
      <circle cx={775} cy={19} r={4} fill={C.mut} />
      <path d="M769 30 a6 5 0 0 1 12 0" fill={C.mut} />

      {/* Conteúdo */}
      <g transform="translate(170,46)">
        <rect x={0} y={0} width={630} height={454} fill={C.page} />
        {children}
      </g>
    </svg>
  );
}

/* ── Primitivos de conteúdo ──────────────────────────────────────────── */

function Txt({
  x,
  y,
  children,
  size = 11,
  weight = 500,
  fill = C.ink,
  anchor = "start",
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  weight?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} fill={fill} textAnchor={anchor}>
      {children}
    </text>
  );
}

function Pill({
  x,
  y,
  w,
  label,
  bg,
  fg,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={17} rx={8.5} fill={bg} />
      <text x={x + w / 2} y={y + 12} fontSize={9} fontWeight={700} fill={fg} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function Btn({
  x,
  y,
  w,
  label,
  solid = true,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  solid?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={22}
        rx={6}
        fill={solid ? C.brand : "#fff"}
        stroke={solid ? "none" : C.border}
      />
      <text
        x={x + w / 2}
        y={y + 15}
        fontSize={10}
        fontWeight={700}
        fill={solid ? "#fff" : C.soft}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

/* ── 1. Dashboard ────────────────────────────────────────────────────── */
export function IlustracaoDashboard() {
  const stats = [
    ["Pedidos hoje", "12"],
    ["Faturamento", "R$ 8.4k"],
    ["A produzir", "5"],
    ["A receber", "R$ 3.1k"],
  ];
  return (
    <Shell active="dashboard" title="Dashboard">
      <Txt x={20} y={30} size={13} weight={700}>
        Bom dia, Casa do Pão 👋
      </Txt>
      {/* Cards de indicadores */}
      {stats.map(([label, val], i) => {
        const x = 20 + i * 148;
        return (
          <g key={label}>
            <Panel x={x} y={44} w={136} h={62} />
            <Txt x={x + 14} y={68} size={9} fill={C.soft}>
              {label}
            </Txt>
            <Txt x={x + 14} y={90} size={18} weight={700}>
              {val}
            </Txt>
          </g>
        );
      })}
      {/* Gráfico */}
      <Panel x={20} y={122} w={370} h={200} />
      <Txt x={36} y={148} weight={700}>
        Vendas nos últimos 7 dias
      </Txt>
      {[70, 110, 90, 140, 120, 160, 130].map((h, i) => (
        <rect
          key={i}
          x={40 + i * 48}
          y={300 - h}
          width={26}
          height={h}
          rx={4}
          fill={i === 5 ? C.brand : C.blueBg}
        />
      ))}
      {/* Lista lateral */}
      <Panel x={404} y={122} w={206} h={200} />
      <Txt x={420} y={148} weight={700}>
        Últimos pedidos
      </Txt>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={430} cy={172 + i * 34} r={7} fill={C.line} />
          <rect x={444} y={166 + i * 34} width={90} height={7} rx={3.5} fill="#e5e7eb" />
          <rect x={444} y={178 + i * 34} width={54} height={6} rx={3} fill="#f1f5f9" />
          <Pill x={556} y={165 + i * 34} w={40} label="Novo" bg={C.blueBg} fg={C.active} />
        </g>
      ))}
      <Step n={1} x={-20} y={14} />
      <Step n={2} x={20} y={44} />
      <Step n={3} x={205} y={148} />
    </Shell>
  );
}

/* ── 2. Novo produto ─────────────────────────────────────────────────── */
export function IlustracaoProduto() {
  return (
    <Shell active="produtos" title="Produtos">
      <Btn x={468} y={18} w={124} label="+ Novo Produto" />
      <Panel x={20} y={54} w={572} h={370} />
      <Txt x={40} y={82} size={12} weight={700}>
        Cadastro de produto
      </Txt>
      {[
        ["Nome do produto", "Pão Francês 50g"],
        ["Categoria", "Padaria"],
      ].map(([label, val], i) => (
        <g key={label}>
          <Txt x={40} y={116 + i * 56} size={9} fill={C.soft}>
            {label}
          </Txt>
          <rect x={40} y={124 + i * 56} width={250} height={28} rx={6} fill="#fff" stroke={C.border} />
          <Txt x={52} y={142 + i * 56} size={10}>
            {val}
          </Txt>
        </g>
      ))}
      {[
        ["Preço (R$)", "0,90"],
        ["Unidade", "un"],
      ].map(([label, val], i) => (
        <g key={label}>
          <Txt x={318} y={116 + i * 56} size={9} fill={C.soft}>
            {label}
          </Txt>
          <rect x={318} y={124 + i * 56} width={250} height={28} rx={6} fill="#fff" stroke={C.border} />
          <Txt x={330} y={142 + i * 56} size={10}>
            {val}
          </Txt>
        </g>
      ))}
      {/* Toggle ativo */}
      <rect x={40} y={244} width={34} height={19} rx={9.5} fill={C.green} />
      <circle cx={65} cy={253.5} r={7} fill="#fff" />
      <Txt x={84} y={258} size={10}>
        Produto ativo (aparece no catálogo)
      </Txt>
      {/* Imagem */}
      <Txt x={40} y={296} size={9} fill={C.soft}>
        Imagem
      </Txt>
      <rect x={40} y={304} width={90} height={70} rx={8} fill={C.page} stroke={C.border} strokeDasharray="4 3" />
      <path d="M74 348 l12 -14 10 12 8 -8 12 14 z" fill={C.mut} />
      <circle cx={72} cy={330} r={5} fill={C.mut} />
      <Btn x={468} y={392} w={104} label="Salvar produto" />
      <Step n={1} x={468} y={18} />
      <Step n={2} x={40} y={124} />
      <Step n={3} x={40} y={244} />
      <Step n={4} x={468} y={392} />
    </Shell>
  );
}

/* ── 3. Novo cliente ─────────────────────────────────────────────────── */
export function IlustracaoCliente() {
  return (
    <Shell active="clientes" title="Clientes">
      <Btn x={470} y={18} w={122} label="+ Novo Cliente" />
      {/* Tabela */}
      <Panel x={20} y={54} w={340} h={370} />
      <Txt x={38} y={80} weight={700}>
        Seus clientes
      </Txt>
      {["Padaria Central", "Mercado do Zé", "Café da Esquina", "Buffet Aurora"].map((n, i) => (
        <g key={n}>
          <line x1={36} y1={96 + i * 46} x2={344} y2={96 + i * 46} stroke={C.line} />
          <circle cx={52} cy={120 + i * 46} r={11} fill={C.blueBg} />
          <Txt x={72} y={116 + i * 46} size={11} weight={600}>
            {n}
          </Txt>
          <Txt x={72} y={130 + i * 46} size={8.5} fill={C.mut}>
            contato@email.com
          </Txt>
        </g>
      ))}
      {/* Form */}
      <Panel x={372} y={54} w={220} h={370} />
      <Txt x={390} y={80} weight={700}>
        Novo cliente
      </Txt>
      {["Nome / Razão social", "E-mail", "Telefone", "CNPJ"].map((label, i) => (
        <g key={label}>
          <Txt x={390} y={108 + i * 58} size={9} fill={C.soft}>
            {label}
          </Txt>
          <rect x={390} y={116 + i * 58} width={184} height={26} rx={6} fill="#fff" stroke={C.border} />
        </g>
      ))}
      <Btn x={390} y={378} w={184} label="Enviar convite" />
      <Step n={1} x={470} y={18} />
      <Step n={2} x={390} y={116} />
      <Step n={3} x={390} y={378} />
    </Shell>
  );
}

/* ── 4. Aprovar pedido ───────────────────────────────────────────────── */
export function IlustracaoAprovacao() {
  return (
    <Shell active="aprovacoes" title="Aprovações">
      <Txt x={20} y={32} size={12} weight={700}>
        Pedidos aguardando revisão
      </Txt>
      {[0, 1, 2].map((i) => {
        const y = 48 + i * 108;
        return (
          <g key={i}>
            <Panel x={20} y={y} w={572} h={92} />
            <circle cx={48} cy={y + 30} r={12} fill={C.blueBg} />
            <Txt x={70} y={y + 26} size={11} weight={700}>
              Pedido #{1042 - i}
            </Txt>
            <Txt x={70} y={y + 42} size={9} fill={C.soft}>
              Padaria Central · 24 itens
            </Txt>
            <Pill x={70} y={y + 54} w={92} label="Aguardando" bg={C.amberBg} fg={C.amber} />
            <Txt x={470} y={y + 30} size={16} weight={700} anchor="end">
              R$ 1.240,00
            </Txt>
            <Txt x={470} y={y + 46} size={8.5} fill={C.mut} anchor="end">
              vence em 7 dias
            </Txt>
            <Btn x={486} y={y + 20} w={44} label="✕" solid={false} />
            <Btn x={536} y={y + 20} w={56} label="Aprovar" />
          </g>
        );
      })}
      <Step n={1} x={40} y={78} />
      <Step n={2} x={536} y={68} />
    </Shell>
  );
}

/* ── 5. Produção / entrega ───────────────────────────────────────────── */
export function IlustracaoProducao() {
  const cols: [string, string, string, string[]][] = [
    ["Em Produção", C.amberBg, C.amber, ["#1041", "#1039"]],
    ["Em Entrega", C.blueBg, C.active, ["#1038"]],
    ["Entregue", C.greenBg, C.green, ["#1036", "#1035"]],
  ];
  return (
    <Shell active="producao" title="Produção">
      <Txt x={20} y={30} size={12} weight={700}>
        Quadro de produção
      </Txt>
      {cols.map(([title, bg, fg, cards], ci) => {
        const x = 20 + ci * 194;
        return (
          <g key={title}>
            <rect x={x} y={44} width={180} height={378} rx={10} fill="#f3f4f6" />
            <Pill x={x + 12} y={58} w={90} label={title} bg={bg} fg={fg} />
            {cards.map((c, i) => (
              <g key={c}>
                <Panel x={x + 12} y={86 + i * 74} w={156} h={64} />
                <Txt x={x + 26} y={110 + i * 74} size={11} weight={700}>
                  Pedido {c}
                </Txt>
                <Txt x={x + 26} y={126 + i * 74} size={8.5} fill={C.mut}>
                  Padaria Central
                </Txt>
                <rect x={x + 26} y={134 + i * 74} width={70} height={6} rx={3} fill={C.line} />
              </g>
            ))}
          </g>
        );
      })}
      <Step n={1} x={44} y={64} />
      <Step n={2} x={220} y={110} />
      <Step n={3} x={420} y={64} />
    </Shell>
  );
}

/* ── 6. Nota fiscal ──────────────────────────────────────────────────── */
export function IlustracaoNotaFiscal() {
  return (
    <Shell active="notas" title="Notas Fiscais">
      {/* Detalhe do pedido com botão emitir */}
      <Panel x={20} y={20} w={572} h={92} />
      <Txt x={40} y={48} size={12} weight={700}>
        Pedido #1042 · Aprovado
      </Txt>
      <Txt x={40} y={66} size={9} fill={C.soft}>
        Padaria Central · CNPJ 12.345.678/0001-90
      </Txt>
      <Pill x={40} y={78} w={72} label="Sem nota" bg={C.amberBg} fg={C.amber} />
      <Btn x={452} y={52} w={120} label="Emitir NF-e" />
      {/* Lista de notas */}
      <Panel x={20} y={128} w={572} h={296} />
      <Txt x={40} y={154} weight={700}>
        Notas emitidas
      </Txt>
      {/* Cabeçalho tabela */}
      <Txt x={40} y={180} size={9} fill={C.mut}>Número</Txt>
      <Txt x={150} y={180} size={9} fill={C.mut}>Cliente</Txt>
      <Txt x={330} y={180} size={9} fill={C.mut}>Valor</Txt>
      <Txt x={430} y={180} size={9} fill={C.mut}>Status</Txt>
      <Txt x={520} y={180} size={9} fill={C.mut}>Ações</Txt>
      {[
        ["000.041", "Autorizada", C.greenBg, C.green],
        ["000.040", "Autorizada", C.greenBg, C.green],
        ["000.039", "Processando", C.amberBg, C.amber],
      ].map(([num, st, bg, fg], i) => (
        <g key={num as string}>
          <line x1={36} y1={192 + i * 44} x2={576} y2={192 + i * 44} stroke={C.line} />
          <Txt x={40} y={216 + i * 44} size={10} weight={600}>
            {num}
          </Txt>
          <Txt x={150} y={216 + i * 44} size={10}>
            Padaria Central
          </Txt>
          <Txt x={330} y={216 + i * 44} size={10}>
            R$ 1.240
          </Txt>
          <Pill x={430} y={205 + i * 44} w={78} label={st as string} bg={bg as string} fg={fg as string} />
          {/* ícones de ação */}
          <rect x={520} y={205 + i * 44} width={16} height={16} rx={4} fill={C.page} stroke={C.border} />
          <rect x={540} y={205 + i * 44} width={16} height={16} rx={4} fill={C.page} stroke={C.border} />
        </g>
      ))}
      <Step n={1} x={452} y={52} />
      <Step n={2} x={472} y={205} />
      <Step n={3} x={528} y={183} />
    </Shell>
  );
}

/* ── 7. Financeiro / boletos ─────────────────────────────────────────── */
export function IlustracaoFinanceiro() {
  return (
    <Shell active="financeiro" title="Financeiro">
      {/* resumo */}
      {[
        ["A receber", "R$ 12.480", C.amber],
        ["Recebido no mês", "R$ 34.900", C.green],
        ["Vencidos", "R$ 1.120", C.red],
      ].map(([label, val, col], i) => (
        <g key={label}>
          <Panel x={20 + i * 194} y={20} w={180} h={58} />
          <Txt x={36 + i * 194} y={42} size={9} fill={C.soft}>
            {label}
          </Txt>
          <Txt x={36 + i * 194} y={64} size={16} weight={700} fill={col}>
            {val}
          </Txt>
        </g>
      ))}
      <Panel x={20} y={92} w={572} h={332} />
      <Txt x={40} y={118} weight={700}>
        Cobranças
      </Txt>
      {[
        ["Padaria Central", "R$ 1.240", "Pago", C.greenBg, C.green],
        ["Mercado do Zé", "R$ 860", "Aguardando", C.amberBg, C.amber],
        ["Café da Esquina", "R$ 430", "Vencido", C.redBg, C.red],
      ].map(([nome, val, st, bg, fg], i) => (
        <g key={nome as string}>
          <line x1={36} y1={132 + i * 62} x2={576} y2={132 + i * 62} stroke={C.line} />
          <Txt x={40} y={160 + i * 62} size={11} weight={600}>
            {nome}
          </Txt>
          <Txt x={40} y={176 + i * 62} size={8.5} fill={C.mut}>
            Boleto · vence 05/09
          </Txt>
          <Txt x={300} y={166 + i * 62} size={13} weight={700}>
            {val}
          </Txt>
          <Pill x={392} y={156 + i * 62} w={78} label={st as string} bg={bg as string} fg={fg as string} />
          <Btn x={486} y={155 + i * 62} w={86} label="Gerar boleto" solid={i !== 0} />
        </g>
      ))}
      <Step n={1} x={528} y={155} />
      <Step n={2} x={40} y={300} />
    </Shell>
  );
}

/* ── 8. CRM / WhatsApp (inbox) ───────────────────────────────────────── */
export function IlustracaoCrm() {
  return (
    <Shell active="crm" title="CRM">
      {/* coluna de leads */}
      <Panel x={20} y={20} w={190} h={404} />
      <Txt x={38} y={44} weight={700}>
        Leads
      </Txt>
      {["Fernando", "Juliana", "Marcos", "Padaria Sol"].map((n, i) => (
        <g key={n}>
          <rect
            x={30}
            y={56 + i * 62}
            width={170}
            height={52}
            rx={8}
            fill={i === 0 ? C.blueBg : "#fff"}
            stroke={i === 0 ? C.active : C.border}
          />
          <circle cx={50} cy={82 + i * 62} r={11} fill={C.line} />
          <Txt x={68} y={78 + i * 62} size={10} weight={700}>
            {n}
          </Txt>
          <Txt x={68} y={92 + i * 62} size={8} fill={C.mut}>
            Olá, gostaria de...
          </Txt>
          {i === 1 && <circle cx={192} cy={68 + i * 62} r={7} fill={C.green} />}
        </g>
      ))}
      {/* Conversa */}
      <rect x={220} y={20} width={372} height={404} rx={10} fill="#efeae2" />
      <rect x={220} y={20} width={372} height={40} rx={10} fill="#fff" />
      <circle cx={244} cy={40} r={11} fill={C.blueBg} />
      <Txt x={262} y={44} weight={700}>
        Fernando
      </Txt>
      {/* bolhas recebidas */}
      {[
        ["Bom dia! Vocês têm pão integral?", false, 84],
        ["Bom dia! Temos sim 🙂 Quer que eu monte um pedido?", true, 132],
        ["Pode ser, 20 unidades", false, 188],
      ].map(([txt, out, y], i) => {
        const w = 210;
        const x = out ? 592 - 16 - w : 236;
        return (
          <g key={i}>
            <rect x={x} y={y as number} width={w} height={36} rx={9} fill={out ? "#d9fdd3" : "#fff"} />
            <Txt x={x + 12} y={(y as number) + 22} size={9.5}>
              {txt as string}
            </Txt>
          </g>
        );
      })}
      {/* campo de resposta */}
      <rect x={236} y={388} width={280} height={26} rx={13} fill="#fff" stroke={C.border} />
      <Txt x={250} y={405} size={9.5} fill={C.mut}>
        Escreva uma mensagem…
      </Txt>
      <circle cx={540} cy={401} r={16} fill={C.green} />
      <path d="M533 401 l14 -5 -5 5 5 5 z" fill="#fff" />
      <Step n={1} x={36} y={82} />
      <Step n={2} x={406} y={150} />
      <Step n={3} x={540} y={401} />
    </Shell>
  );
}

/* ── 9. Configurações / integrações ──────────────────────────────────── */
export function IlustracaoIntegracoes() {
  const items: [string, string, boolean][] = [
    ["Mercado Pago", "Links de pagamento automáticos", true],
    ["SEFAZ · NF-e", "Emissão de notas fiscais", true],
    ["WhatsApp", "Atendimento e disparos", false],
    ["E-mail (Resend)", "Envio de convites e avisos", true],
  ];
  return (
    <Shell active="config" title="Configurações">
      {/* abas */}
      {["Dados fiscais", "Integrações", "Usuários", "Loja online"].map((t, i) => (
        <g key={t}>
          <Txt x={24 + i * 96} y={34} size={10} weight={i === 1 ? 700 : 500} fill={i === 1 ? C.brand : C.mut}>
            {t}
          </Txt>
          {i === 1 && <rect x={20 + i * 96} y={42} width={72} height={3} rx={2} fill={C.brand} />}
        </g>
      ))}
      <line x1={20} y1={45} x2={592} y2={45} stroke={C.border} />
      {items.map(([name, desc, on], i) => {
        const y = 62 + i * 88;
        return (
          <g key={name}>
            <Panel x={20} y={y} w={572} h={72} />
            <rect x={38} y={y + 18} width={36} height={36} rx={9} fill={C.blueBg} />
            <Txt x={90} y={y + 32} size={12} weight={700}>
              {name}
            </Txt>
            <Txt x={90} y={y + 50} size={9} fill={C.soft}>
              {desc}
            </Txt>
            {on ? (
              <Pill x={430} y={y + 26} w={78} label="Conectado" bg={C.greenBg} fg={C.green} />
            ) : (
              <Btn x={472} y={y + 24} w={100} label="Conectar" />
            )}
          </g>
        );
      })}
      <Step n={1} x={116} y={34} />
      <Step n={2} x={522} y={86} />
      <Step n={3} x={522} y={262} />
    </Shell>
  );
}
