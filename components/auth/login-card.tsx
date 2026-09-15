"use client";

import { useRef, type ReactNode } from "react";
import { PlusIcon, type PlusIconHandle } from "@/components/icons/plus-icon";

const SYSTEM_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, 'Segoe UI', sans-serif";

/**
 * Tela de login enxuta - sem Prism/DecryptedText/video, que sao pesados
 * demais pra abrir todo dia em PC fraco. A apresentacao "bonita" ficou
 * separada em solairew.com.br (MarketingSite); aqui e so acesso ao sistema.
 */
export function LoginCard({ children }: { children: ReactNode }) {
  const plusIconRef = useRef<PlusIconHandle>(null);

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08090b] px-5 py-10 text-white"
      style={{ fontFamily: SYSTEM_FONT }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.06), transparent 55%), linear-gradient(180deg, #0c0d0f 0%, #08090b 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[420px] motion-safe:animate-fade-in-up">
        <a
          href="/"
          className="mb-8 flex items-center justify-center gap-3 transition-opacity duration-150 ease-premium active:opacity-70"
          aria-label="Solaire W+ CRM"
          onMouseEnter={() => plusIconRef.current?.startAnimation()}
          onMouseLeave={() => plusIconRef.current?.stopAnimation()}
        >
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white text-[11px] font-bold text-[#08090b] shadow-[0_1px_2px_rgba(0,0,0,.4)]">
            <span className="flex items-center">
              W
              <PlusIcon ref={plusIconRef} size={12} className="text-[#08090b]" />
            </span>
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[-0.01em] text-white">Solaire W+</span>
            <span className="block text-[8px] font-semibold uppercase tracking-[0.22em] text-white/40">CRM</span>
          </span>
        </a>

        <div className="rounded-2xl bg-white/[0.035] p-6 shadow-[0_1px_0_rgba(255,255,255,.06)_inset,0_24px_70px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
