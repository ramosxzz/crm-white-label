"use client";

import { useRef, type ReactNode } from "react";
import { PlusIcon, type PlusIconHandle } from "@/components/icons/plus-icon";

/**
 * Tela de login enxuta - sem Prism/DecryptedText/video, que sao pesados
 * demais pra abrir todo dia em PC fraco. A apresentacao "bonita" ficou
 * separada em solairew.com.br (MarketingSite); aqui e so acesso ao sistema.
 */
export function LoginCard({ children }: { children: ReactNode }) {
  const plusIconRef = useRef<PlusIconHandle>(null);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05070c] px-5 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 24% 12%, rgba(37,99,235,.28), transparent 46%), radial-gradient(ellipse at 76% 88%, rgba(6,182,212,.16), transparent 42%), linear-gradient(180deg, #060914 0%, #05070c 72%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[430px]">
        <a
          href="/"
          className="mb-7 flex items-center justify-center gap-3"
          aria-label="Solaire W+ CRM"
          onMouseEnter={() => plusIconRef.current?.startAnimation()}
          onMouseLeave={() => plusIconRef.current?.stopAnimation()}
        >
          <span className="grid h-9 w-9 place-items-center border border-white/20 bg-white/10 font-display text-[11px] font-bold text-white shadow-[0_0_28px_rgba(37,99,235,.2)]">
            <span className="flex items-center">
              W
              <PlusIcon ref={plusIconRef} size={12} className="text-white" />
            </span>
          </span>
          <span>
            <span className="block font-display text-sm font-semibold tracking-tight">Solaire W+</span>
            <span className="block text-[8px] font-semibold uppercase tracking-[0.2em] text-white/40">CRM</span>
          </span>
        </a>

        <div className="border border-white/12 bg-[#090b11] p-6 shadow-[0_34px_100px_rgba(0,0,0,.72)] sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
