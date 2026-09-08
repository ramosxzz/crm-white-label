import { Lock } from "lucide-react";
import { buildDemoWhatsappUrl } from "@/lib/demo-whatsapp";

/**
 * Bloqueio de conta suspensa. Diferente do PaymentOverdueBanner (so avisa,
 * app continua liberado) - aqui a conta fica travada de verdade, sem
 * renderizar sidebar/conteudo nenhum.
 */
export function TenantSuspendedScreen({ reason }: { reason: string | null }) {
  const whatsappUrl = buildDemoWhatsappUrl();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070c] px-5 text-white">
      <div className="w-full max-w-md border border-white/12 bg-[#090b11] p-8 text-center shadow-[0_34px_100px_rgba(0,0,0,.72)]">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-400">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Conta suspensa</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">
          {reason?.trim() || "O acesso a este CRM foi suspenso. Entre em contato com a Solaire W+ para regularizar."}
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-[#05070c] transition-colors hover:bg-cyan-50"
        >
          Falar com a Solaire W+
        </a>
      </div>
    </div>
  );
}
