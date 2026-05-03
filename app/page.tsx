import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MessageCircle, Mail, ChevronRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { PwaInstallButton } from "@/components/ui/pwa-install-button";

export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white antialiased">

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes heroUp {
          from { opacity: 0; transform: translateY(36px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroScale {
          from { opacity: 0; transform: translateY(48px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .h-title  { animation: heroUp  0.8s cubic-bezier(0.16,1,0.3,1) 0.2s both; }
        .h-sub    { animation: heroUp  0.8s cubic-bezier(0.16,1,0.3,1) 0.35s both; }
        .h-cta    { animation: heroUp  0.8s cubic-bezier(0.16,1,0.3,1) 0.48s both; }
        .h-screen { animation: heroScale 1s cubic-bezier(0.16,1,0.3,1) 0.65s both; }

        .browser-bar::before {
          content: '';
          display: inline-block;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 18px 0 0 #f59e0b, 36px 0 0 #22c55e;
        }
      `}</style>

      {/* ════════════════ HEADER ════════════════ */}
      <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Image src="/ondda-logo.png" alt="Ondda" width={90} height={36} className="h-9 w-auto" />

          <nav className="hidden gap-7 md:flex">
            {["Funcionalidades","Como funciona","App","Contato"].map((item) => (
              <a key={item}
                href={`#${item === "Funcionalidades" ? "features" : item === "Como funciona" ? "steps" : item === "App" ? "app" : "contact"}`}
                className="text-sm text-slate-600 transition-colors hover:text-slate-900"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Começar grátis <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative overflow-hidden bg-white px-6 pb-0 pt-24 text-center">
        {/* Mesh gradient bg */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-blue-100/60 via-cyan-50/30 to-transparent blur-3xl" />
        </div>

        {/* Headline */}
        <h1 className="h-title mx-auto max-w-4xl text-5xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
          Tudo que sua{" "}
          <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
            produção
          </span>{" "}
          precisa
        </h1>

        {/* Subtitle */}
        <p className="h-sub mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl">
          Pedidos, produção, financeiro, NF-e e loja online — em uma única plataforma
          feita para distribuidoras crescerem sem complicação.
        </p>

        {/* CTAs */}
        <div className="h-cta mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
          >
            Criar conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4 text-slate-400" />
            Falar com especialista
          </a>
        </div>

        {/* Hero screenshot */}
        <div className="h-screen relative mx-auto mt-16 max-w-5xl">
          {/* Browser frame */}
          <div className="overflow-hidden rounded-t-2xl border border-slate-200 shadow-[0_30px_80px_-10px_rgba(0,0,0,0.15)]">
            {/* Chrome bar */}
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="browser-bar" />
              <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md bg-white border border-slate-200 text-xs text-slate-400">
                app.ondda.com.br/dashboard
              </div>
            </div>
            {/* Screenshot */}
            <div className="relative bg-slate-100" style={{ aspectRatio: "16/9" }}>
              <Image
                src="/dashboard.png"
                alt="Dashboard Ondda"
                fill
                className="object-contain object-top"
              />
            </div>
          </div>
          {/* Bottom fade */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
        </div>
      </section>

      {/* ════════════════ FEATURES ════════════════ */}
      <section id="features" className="scroll-mt-14 bg-white px-6 pt-24 pb-20">
        <div className="mx-auto max-w-6xl">

          <Reveal className="mb-4 text-center">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Funcionalidades
            </span>
          </Reveal>

          <Reveal delay={80} className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Uma plataforma, zero complicação
            </h2>
            <p className="mt-3 text-lg text-slate-500">
              Do pedido à nota fiscal — tudo integrado
            </p>
          </Reveal>

          {/* Bento grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {/* Card grande — Pedidos */}
            <Reveal direction="up" delay={0} className="lg:col-span-2 lg:row-span-2">
              <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 transition hover:border-blue-200 hover:shadow-lg">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-600">Gestão de Pedidos</div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">Do pedido à entrega, sem perder nada</h3>
                <p className="mb-6 text-sm leading-relaxed text-slate-500">
                  Fluxo completo com aprovação, produção e entrega. Clientes fazem pedidos pela loja online e você acompanha tudo em tempo real.
                </p>
                {/* Mini mockup */}
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <div className="h-2 w-2 rounded-full bg-yellow-400" />
                    <div className="h-2 w-2 rounded-full bg-green-400" />
                  </div>
                  <div className="relative bg-slate-100" style={{ aspectRatio: "4/3" }}>
                    <Image src="/screenshots/pedidos.png" alt="Pedidos" fill className="object-cover object-top" />
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-slate-100 p-4">
                      {["Pedido #A8F2 · João Silva","Pedido #C3D1 · Maria Costa","Pedido #E7B4 · Pedro Lima"].map((p, i) => (
                        <div key={p} className="mb-2 flex items-center justify-between rounded-lg border border-white bg-white px-3 py-2 shadow-sm">
                          <div>
                            <div className="text-xs font-semibold text-slate-800">{p}</div>
                            <div className="text-[10px] text-slate-400">Hoje, {8+i}:30</div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${i===0?"bg-yellow-100 text-yellow-700":i===1?"bg-blue-100 text-blue-700":"bg-green-100 text-green-700"}`}>
                            {i===0?"Aguardando":i===1?"Produção":"Pronto"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Card — Loja Online */}
            <Reveal direction="up" delay={80}>
              <div className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-50/60 to-white p-6 transition hover:border-cyan-200 hover:shadow-lg">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-600">Loja Online</div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">Catálogo público para seus clientes</h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  Cada distribuidora tem sua própria URL. Clientes pedem pelo celular, 24h por dia.
                </p>
                <div className="mt-4 rounded-lg border border-cyan-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="h-2 w-2 rounded-full bg-cyan-400" />
                    ondda.com.br/loja/<span className="font-mono font-semibold text-slate-700">sua-empresa</span>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Card — Financeiro */}
            <Reveal direction="up" delay={160}>
              <div className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-green-50/60 to-white p-6 transition hover:border-green-200 hover:shadow-lg">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-green-600">Financeiro</div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">Recebimentos e custos centralizados</h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  Visão consolidada de pagamentos pendentes, recebidos e custos operacionais.
                </p>
                <div className="mt-4 flex items-end gap-1">
                  {[40,65,45,80,60,90,75].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: `${h*0.5}px`, background: i===5?"#16a34a":"#dcfce7" }} />
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Card — NF-e */}
            <Reveal direction="up" delay={0}>
              <div className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50/40 to-white p-6 transition hover:border-orange-100 hover:shadow-lg">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-orange-600">NF-e</div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">Notas fiscais em 1 clique</h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  Emita NF-e diretamente dos pedidos, com integração à SEFAZ. Dados do cliente e empresa já preenchidos.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" /> NF-e autorizada
                </div>
              </div>
            </Reveal>

            {/* Card — Pagamentos */}
            <Reveal direction="up" delay={80}>
              <div className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-purple-50/50 to-white p-6 transition hover:border-purple-200 hover:shadow-lg">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-purple-600">Pagamentos</div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">PIX e cartão via Mercado Pago</h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  Gere links de pagamento e QR codes direto do pedido. Sem sair do sistema.
                </p>
                <div className="mt-4 flex gap-2">
                  {["PIX","Boleto","Crédito","Débito"].map(m => (
                    <span key={m} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{m}</span>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Card — Multi-usuário */}
            <Reveal direction="up" delay={160}>
              <div className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 transition hover:shadow-lg">
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Acesso</div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">Papéis e permissões</h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  Admin, gerente, operador e cliente. Cada um vê apenas o que precisa.
                </p>
                <div className="mt-4 flex -space-x-2">
                  {["A","G","O","C"].map((l, i) => (
                    <div key={l} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ${["bg-blue-800","bg-blue-600","bg-cyan-600","bg-slate-400"][i]}`}>{l}</div>
                  ))}
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ════════════════ FEATURE SPOTLIGHT ════════════════ */}
      <section className="bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-6xl space-y-24">

          {/* Row 1: Produção */}
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <Reveal direction="left">
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Controle de Produção</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Sua equipe sempre alinhada
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-500">
                Painel dedicado para atualizar o status de cada pedido em tempo real. Operadores veem só o que precisam, sem complexidade.
              </p>
              <ul className="mt-6 space-y-3">
                {["Atualização de status em tempo real","Visão por etapa: aprovado → em produção → pronto","Sem treinamento — interface limpa e direta"].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <div className="mt-1 h-4 w-4 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal direction="right" delay={100}>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-slate-400">Produção</span>
                </div>
                <div className="relative" style={{ aspectRatio: "4/3" }}>
                  <Image src="/screenshots/producao.png" alt="Produção" fill className="object-cover object-top" />
                  <div className="absolute inset-0 bg-white p-4">
                    <div className="mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Em Produção</div>
                    {[
                      { name: "Pão de Forma · 50un", time: "08:15", color: "bg-blue-100 text-blue-700" },
                      { name: "Brioche · 30un",      time: "09:00", color: "bg-cyan-100 text-cyan-700" },
                      { name: "Ciabatta · 20un",     time: "09:30", color: "bg-indigo-100 text-indigo-700" },
                    ].map(item => (
                      <div key={item.name} className="mb-2 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                        <div>
                          <div className="text-xs font-medium text-slate-800">{item.name}</div>
                          <div className="text-[10px] text-slate-400">Iniciado às {item.time}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.color}`}>Em produção</span>
                      </div>
                    ))}
                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" />
                    </div>
                    <div className="mt-1 text-right text-[10px] text-slate-400">67% concluído</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Row 2: Loja */}
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <Reveal direction="left" delay={100}>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-slate-400">ondda.com.br/loja/padaria-nobre</span>
                </div>
                <div className="relative" style={{ aspectRatio: "4/3" }}>
                  <Image src="/screenshots/loja.png" alt="Loja Online" fill className="object-cover object-top" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900">Padaria Nobre</div>
                      <div className="rounded-full bg-blue-800 px-3 py-1 text-[10px] font-semibold text-white">0 itens</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {["Pão Francês","Bolo Integral","Croissant","Brioche"].map((p, i) => (
                        <div key={p} className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                          <div className={`mb-2 h-12 rounded-md ${["bg-yellow-100","bg-orange-100","bg-amber-100","bg-yellow-50"][i]}`} />
                          <div className="text-[10px] font-semibold text-slate-800">{p}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <div className="text-[10px] text-slate-400">R$ {(8+i*2).toFixed(2)}</div>
                            <div className="h-4 w-4 rounded-full bg-blue-800 flex items-center justify-center text-[8px] text-white font-bold">+</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal direction="right">
              <span className="text-xs font-semibold uppercase tracking-widest text-cyan-600">Loja Online</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Sua loja no ar em minutos
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-500">
                Cada distribuidora recebe uma URL única. Personalize com logo, banner e cores. Clientes pedem de qualquer lugar, a qualquer hora.
              </p>
              <ul className="mt-6 space-y-3">
                {["URL exclusiva por distribuidora","Personalize cores, logo e banner","Pedidos entram direto no painel — sem intermediários"].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <div className="mt-1 h-4 w-4 flex-shrink-0 rounded-full bg-cyan-100 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

        </div>
      </section>

      {/* ════════════════ HOW IT WORKS ════════════════ */}
      <section id="steps" className="scroll-mt-14 bg-white px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mb-16 text-center">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Como funciona
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Do zero ao primeiro pedido em minutos
            </h2>
          </Reveal>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* Linha conectora */}
            <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent md:block" />

            {[
              { n: "01", title: "Crie sua conta", desc: "Nome da empresa, email e senha. Menos de 2 minutos. Gratuito para começar." },
              { n: "02", title: "Configure sua empresa", desc: "Adicione produtos, dados fiscais e personalize a loja com sua identidade visual." },
              { n: "03", title: "Receba pedidos", desc: "Compartilhe o link da sua loja. Gerencie pedidos, produção e entregas pelo painel." },
            ].map(({ n, title, desc }, i) => (
              <Reveal key={n} direction="up" delay={i * 100}>
                <div className="relative text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl font-extrabold text-slate-900 shadow-sm">
                    {n}
                  </div>
                  <h3 className="mb-2 text-base font-bold text-slate-900">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ APP DOWNLOAD ════════════════ */}
      <section id="app" className="scroll-mt-14 bg-gradient-to-b from-blue-50 to-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 md:grid-cols-2">

            {/* Texto */}
            <Reveal direction="left">
              <div>
                <span className="mb-4 inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-700">
                  App para clientes
                </span>
                <h2 className="mt-3 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
                  Seu cliente acompanha<br /> tudo pelo celular
                </h2>
                <p className="mt-4 text-lg text-slate-500">
                  Instale o app Ondda e tenha acesso ao catálogo, pedidos e status de entrega — direto na tela inicial do celular.
                </p>

                {/* Steps */}
                <div className="mt-8 space-y-4">
                  {[
                    { os: "Android", icon: "🤖", steps: ["Abra o site no Chrome", "Toque no menu (3 pontinhos) no canto superior direito", 'Selecione "Adicionar à tela inicial"'] },
                    { os: "iPhone", icon: "🍎", steps: ["Abra o site no Safari", "Toque no botão Compartilhar (quadrado com seta)", 'Selecione "Adicionar à Tela de Início"'] },
                  ].map(({ os, icon, steps }) => (
                    <div key={os} className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="mb-2 text-sm font-semibold text-slate-800">{icon} {os}</p>
                      <ol className="space-y-1">
                        {steps.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <PwaInstallButton />
                </div>
              </div>
            </Reveal>

            {/* Phone mockup */}
            <Reveal direction="right">
              <div className="flex justify-center">
                <div className="relative">
                  {/* Glow */}
                  <div className="absolute inset-0 -z-10 scale-90 rounded-[2.5rem] bg-blue-200 blur-3xl opacity-60" />
                  {/* Phone frame */}
                  <div className="relative w-64 rounded-[2.2rem] border-[6px] border-slate-800 bg-white shadow-2xl overflow-hidden">
                    {/* Status bar */}
                    <div className="flex items-center justify-between bg-slate-800 px-5 py-2">
                      <span className="text-[10px] font-medium text-white/80">9:41</span>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-3 rounded-sm bg-white/60" />
                        <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
                        <div className="h-1.5 w-3 rounded-sm bg-white/60" />
                      </div>
                    </div>
                    {/* App content */}
                    <div className="bg-white px-4 py-4">
                      {/* Header */}
                      <div className="mb-3 flex items-center justify-between">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/ondda-logo.png" alt="Ondda" className="h-7 w-7 rounded-lg" />
                        <span className="text-xs font-bold text-slate-800">Catálogo</span>
                        <div className="h-6 w-6 rounded-full bg-blue-100" />
                      </div>
                      {/* Search bar */}
                      <div className="mb-3 h-7 rounded-lg bg-slate-100" />
                      {/* Product cards */}
                      <div className="grid grid-cols-2 gap-2">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="rounded-xl border border-slate-100 p-2">
                            <div className="mb-1.5 h-14 rounded-lg bg-blue-50" />
                            <div className="h-2 w-3/4 rounded bg-slate-200" />
                            <div className="mt-1 h-2 w-1/2 rounded bg-slate-100" />
                            <div className="mt-2 h-5 w-full rounded-lg bg-blue-800" />
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Bottom nav */}
                    <div className="flex justify-around border-t border-slate-100 bg-white px-2 py-2">
                      {["🏠","📦","🛒","👤"].map((icon, i) => (
                        <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${i === 2 ? "bg-blue-800" : ""}`}>
                          {icon}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Notification badge */}
                  <div className="absolute -right-3 top-24 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-lg">
                    <p className="text-[10px] font-bold text-slate-800">🚀 Pedido aprovado!</p>
                    <p className="text-[9px] text-slate-400">Produção iniciada</p>
                  </div>
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ════════════════ CTA ════════════════ */}
      <section className="bg-slate-900 px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Pronto para transformar sua<br className="hidden sm:block" /> distribuidora?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Crie sua conta grátis e explore todas as funcionalidades.
          </p>
          <Link
            href="/cadastro"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-slate-900 shadow-lg transition hover:bg-slate-100"
          >
            Começar agora — é grátis <ArrowRight className="h-5 w-5" />
          </Link>
        </Reveal>
      </section>

      {/* ════════════════ CONTACT ════════════════ */}
      <section id="contact" className="scroll-mt-14 bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="text-2xl font-bold text-slate-900">Fale com a gente</h2>
            <p className="mt-3 text-slate-500">Dúvidas ou demonstração personalizada</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="https://wa.me/5511945172652" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                <MessageCircle className="h-4 w-4 text-green-500" /> WhatsApp
              </a>
              <a href="mailto:contato@ondda.com.br"
                className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                <Mail className="h-4 w-4 text-blue-500" /> contato@ondda.com.br
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="border-t border-slate-100 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Image src="/ondda-logo.png" alt="Ondda" width={80} height={32} className="h-8 w-auto" />
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} Ondda. Todos os direitos reservados.</p>
          <div className="flex gap-5 text-sm text-slate-400">
            <Link href="/login" className="transition hover:text-slate-600">Entrar</Link>
            <Link href="/cadastro" className="transition hover:text-slate-600">Criar conta</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
