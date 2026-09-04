"use client";

import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Columns3,
  MessageCircleMore,
  Sparkles,
} from "lucide-react";
import DecryptedText from "@/components/effects/decrypted-text";
import Prism from "@/components/effects/prism";
import ShinyText from "@/components/effects/shiny-text";
import { buildDemoWhatsappUrl } from "@/lib/demo-whatsapp";

const CRM_LOGIN_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.solairew.com.br"}/login`;

const slides = [
  {
    image: "/showcase/conversas.png",
    label: "Atendimento conectado",
    title: "WhatsApp, histórico e equipe na mesma conversa.",
    description: "Centralize contatos, mensagens, notas e próximos passos em um atendimento que não perde contexto.",
    icon: MessageCircleMore,
  },
  {
    image: "/showcase/kanban.png",
    label: "Pipeline comercial",
    title: "Cada lead visível, do primeiro contato ao fechamento.",
    description: "Organize oportunidades em funis personalizáveis e acompanhe quem precisa de atenção agora.",
    icon: Columns3,
  },
  {
    image: "/showcase/dashboard.png",
    label: "Gestão em tempo real",
    title: "Indicadores claros para decidir o próximo movimento.",
    description: "Reúna operação, desempenho, metas e origens em uma visão diária simples de acompanhar.",
    icon: ChartNoAxesCombined,
  },
  {
    image: "/showcase/agenda.png",
    label: "Agenda integrada",
    title: "Compromissos e próximos passos sem perder o ritmo.",
    description: "Conecte agenda, tarefas, reuniões e lembretes ao histórico de cada cliente.",
    icon: CalendarDays,
  },
] as const;

export function MarketingSite() {
  const demoUrl = buildDemoWhatsappUrl();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#05070c] text-white">
      <div className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#05070c]/78 backdrop-blur-2xl">
        <header className="mx-auto flex h-[72px] w-full max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#inicio" className="flex items-center gap-3" aria-label="Solaire W+ CRM">
            <span className="grid h-9 w-9 place-items-center border border-white/20 bg-white/10 font-display text-[11px] font-bold text-white shadow-[0_0_28px_rgba(37,99,235,.2)]">
              W+
            </span>
            <span>
              <span className="block font-display text-sm font-semibold tracking-tight">Solaire W+</span>
              <span className="block text-[8px] font-semibold uppercase tracking-[0.2em] text-white/40">CRM</span>
            </span>
          </a>

          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Ações de acesso">
            <a
              href={CRM_LOGIN_URL}
              className="inline-flex h-10 items-center justify-center gap-2 border border-white/15 bg-white/[0.04] px-4 text-xs font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/[0.08] sm:px-5 sm:text-sm"
            >
              Entrar
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href={demoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center bg-blue-500 px-4 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(37,99,235,.22)] transition-colors hover:bg-blue-400 sm:px-5 sm:text-sm"
            >
              Solicitar demo
            </a>
          </nav>
        </header>
      </div>

      <section id="inicio" className="relative min-h-screen overflow-hidden px-5 pb-20 pt-28 sm:px-8 lg:px-12 lg:pb-24 lg:pt-32">
        <div className="absolute inset-0">
          <Prism
            animationType="rotate"
            timeScale={0.5}
            height={3.5}
            baseWidth={5.5}
            scale={3.6}
            hueShift={0.5}
            colorFrequency={1}
            noise={0.4}
            glow={1}
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,transparent_0%,rgba(5,7,12,.13)_42%,rgba(5,7,12,.88)_100%)]" />

        <div className="relative z-10 mx-auto flex w-full max-w-[1240px] flex-col items-center">
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-cyan-300 sm:text-[10px]">
            <Sparkles className="h-3.5 w-3.5" />
            <ShinyText
              text="UMA OPERAÇÃO MAIS CONECTADA"
              color="rgba(165,243,252,.72)"
              shineColor="#ffffff"
              speed={3.2}
              delay={1}
            />
          </div>

          <div className="mt-3 flex h-[118px] w-full max-w-[860px] items-center justify-center sm:h-[150px] lg:h-[178px]">
            <DecryptedText
              text="CRM W+"
              animateOn="view"
              revealDirection="center"
              sequential
              speed={35}
              maxIterations={12}
              characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*+="
              className="text-[#F8FAFC]"
              encryptedClassName="text-cyan-300/50"
              parentClassName="font-display font-extrabold leading-none text-[clamp(4.2rem,12vw,10rem)] tracking-tight"
            />
          </div>

          <div className="mx-auto -mt-1 max-w-3xl text-center">
            <h1 className="font-display text-2xl font-medium tracking-tight text-white sm:text-3xl lg:text-4xl">
              Sua operação inteira. Uma experiência só.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/52 sm:text-base">
              Leads, atendimento, agenda, automações e gestão comercial trabalhando juntos para sua equipe avançar com clareza.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#recursos"
              className="inline-flex h-11 items-center gap-2 bg-white px-5 text-sm font-semibold text-[#05070c] transition-colors hover:bg-cyan-50"
            >
              Conhecer funcionalidades
              <ArrowDown className="h-4 w-4" />
            </a>
            <a
              href={CRM_LOGIN_URL}
              className="inline-flex h-11 items-center border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/[0.08]"
            >
              Já sou cliente
            </a>
          </div>

          <div className="relative mt-10 w-full max-w-[1120px] overflow-hidden border border-white/15 bg-[#090c12]/90 shadow-[0_42px_120px_rgba(0,0,0,.6),0_0_0_1px_rgba(96,165,250,.06)] backdrop-blur-xl lg:mt-12">
            <div className="flex h-9 items-center justify-between border-b border-white/10 bg-white/[0.035] px-3.5">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-2 w-2 bg-white/20" />
                <span className="h-2 w-2 bg-white/15" />
                <span className="h-2 w-2 bg-white/10" />
              </div>
              <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/35">Solaire W+ CRM</span>
              <span className="h-2 w-10 border border-white/10" />
            </div>

            <div className="relative aspect-video overflow-hidden bg-black">
              <video
                className="h-full w-full object-contain"
                muted
                loop
                playsInline
                controls
                preload="none"
                poster="/videos/crm-w-plus-poster.webp"
                aria-label="Demonstração das funcionalidades do CRM W+"
              >
                <source src="/videos/crm-w-plus-overview.mp4" type="video/mp4" />
              </video>
              <div className="pointer-events-none absolute left-4 top-4 border border-white/10 bg-[#05070c]/80 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200 backdrop-blur-md sm:left-5 sm:top-5 sm:text-[10px]">
                Clique para assistir · 18s
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="relative border-t border-white/10 bg-[#070910] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-8 border-b border-white/10 pb-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Do lead ao pós-venda</p>
              <h2 className="mt-4 max-w-xl font-display text-3xl font-medium tracking-tight text-white sm:text-4xl lg:text-5xl">
                Tudo conversa com tudo.
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-white/48 sm:text-base lg:justify-self-end">
              O CRM W+ reúne os pontos que normalmente ficam espalhados em várias ferramentas. Sua equipe trabalha com contexto; a gestão acompanha o que está acontecendo.
            </p>
          </div>

          <div className="grid border-x border-white/10 sm:grid-cols-2">
            {slides.map((item, index) => {
              const FeatureIcon = item.icon;
              return (
                <article key={item.label} className={`group border-b border-white/10 p-6 sm:p-8 lg:p-10 ${index % 2 === 0 ? "sm:border-r" : ""}`}>
                  <div className="flex items-start justify-between gap-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center border border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-300">
                      <FeatureIcon className="h-4.5 w-4.5" />
                    </span>
                    <span className="font-mono text-[10px] text-white/20">0{index + 1}</span>
                  </div>
                  <h3 className="mt-8 font-display text-xl font-medium text-white sm:text-2xl">{item.label}</h3>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-white/45">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/10 bg-[#05070c] px-5 py-20 text-center sm:px-8 lg:py-28">
        <div className="absolute left-1/2 top-0 h-80 w-[50rem] -translate-x-1/2 bg-[radial-gradient(circle,rgba(37,99,235,.18),transparent_68%)]" />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Veja na sua operação</p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl lg:text-5xl">Uma demonstração feita para o seu processo.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/48 sm:text-base">Converse com a Solaire W+ e descubra como organizar atendimento, vendas e gestão em um único ambiente.</p>
          <a href={demoUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex h-12 items-center gap-2 bg-blue-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-400">
            Solicitar demonstração
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#05070c] px-5 py-6 text-[10px] text-white/30 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4">
          <span>© 2026 Solaire W+ CRM</span>
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-white">Privacidade</a>
            <a href="/terms" className="hover:text-white">Termos</a>
          </div>
        </div>
      </footer>

      <a
        href={demoUrl}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 bg-emerald-500 px-3.5 text-sm font-semibold text-white shadow-[0_18px_46px_rgba(0,0,0,.42)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-400 sm:bottom-7 sm:right-7 sm:px-5"
        aria-label="Fale com a gente pelo WhatsApp"
      >
        <MessageCircleMore className="h-5 w-5" />
        <span className="hidden sm:inline">Fale com a gente</span>
      </a>
    </main>
  );
}
