import Link from "next/link";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";
import { buildDemoWhatsappUrl } from "@/lib/demo-whatsapp";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const demoUrl = buildDemoWhatsappUrl(
    "Ola, quero solicitar uma demo do CRM Solaire W+ e criar um acesso para minha empresa.",
  );

  return (
    <main className="grid min-h-screen place-items-center bg-[#05070c] p-6 text-white">
      <div className="w-full max-w-md border border-white/10 bg-white/[0.035] p-7 shadow-2xl sm:p-9">
      <div className="mb-8 space-y-4">
        <div className="flex h-12 w-12 items-center justify-center border border-white/15 bg-white/[0.06] text-cyan-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Cadastro somente por demo
          </h1>
          <p className="text-sm leading-6 text-white/50">
            Para manter o CRM seguro e bem configurado para cada empresa, novos acessos agora sao
            liberados diretamente pelo time Solaire W+.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Button asChild variant="brand" size="lg" className="w-full">
          <a href={demoUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4" />
            Solicitar demo pelo WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/login">
            <ArrowLeft className="h-4 w-4" />
            Voltar para entrar
          </Link>
        </Button>
      </div>
      </div>
    </main>
  );
}
