import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import Aurora from "@/components/effects/aurora";
import ShinyText from "@/components/effects/shiny-text";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[minmax(520px,0.86fr)_1.14fr]">
      {/* Left: form */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-brand text-brand-foreground font-display text-sm font-bold">
              S
            </div>
            <span className="font-display text-sm font-semibold">Solaire W+ CRM</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

        <div className="p-6 text-center text-xs text-muted-foreground">
          © 2026 Solaire W+ CRM · Todos os direitos reservados
        </div>
      </div>

      {/* Right: hero panel */}
      <div className="relative hidden overflow-hidden bg-[#0f1117] lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Aurora - substitui o glow estatico por um fundo com movimento sutil */}
        <div className="absolute inset-0">
          <Aurora colorStops={["#4F46E5", "#7C3AED", "#38BDF8"]} amplitude={0.8} blend={0.4} speed={0.4} />
        </div>

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--brand)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--brand)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-foreground font-display text-base font-bold shadow-lg">
              S
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-white">Solaire W+ CRM</p>
              <ShinyText
                text="PLATAFORMA WHITE-LABEL"
                className="text-[10px] uppercase tracking-[0.2em]"
                color="rgba(255,255,255,0.4)"
                shineColor="#ffffff"
                speed={3}
                delay={1.5}
              />
            </div>
          </div>
        </div>

        <div className="relative space-y-6">
          <div className="space-y-3">
            <p className="font-display text-4xl font-medium leading-tight text-white">
              CRM completo para sua equipe vender mais e atender melhor.
            </p>
            <p className="text-sm text-white/50">
              Leads, kanban, WhatsApp, Instagram, agenda, automacoes e muito mais — tudo em um so lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Leads & Kanban", desc: "Funis configuráveis" },
              { label: "WhatsApp & Instagram", desc: "Chat integrado" },
              { label: "Automações", desc: "Editor visual" },
              { label: "Multi-tenant", desc: "White-label" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
              >
                <p className="text-xs font-semibold text-white">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            Solaire W+ · 2026
          </p>
        </div>
      </div>
    </div>
  );
}
