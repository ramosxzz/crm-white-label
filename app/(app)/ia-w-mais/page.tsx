import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageAutomations } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAgentForm } from "./ai-agent-form";

export default async function IaWMaisPage() {
  const ctx = await requireContext();
  // O RLS de ai_agents ja recusa escrita fora de owner/admin, mas sem este
  // gate a pagina ainda deixava ler o system_prompt por URL direta e mostrava
  // um formulario "editavel" que falhava calado pra quem nao pode salvar.
  if (!canManageAutomations(ctx.role)) redirect("/dashboard");
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("ai_agents")
    .select("name, system_prompt, model, enabled")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  const hasAiKey = Boolean(process.env.AI_API_KEY);

  return (
    <div>
      <PageHeader
        eyebrow="Sistema"
        title="IA W+"
        description="Agente de IA que responde automaticamente pelo WhatsApp quando ninguem da equipe assumiu a conversa."
      />
      <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-brand" />
              Configuracao do agente
            </CardTitle>
            <CardDescription>
              Defina o nome e a personalidade/instrucoes do agente. Ele usa o historico recente da
              conversa como contexto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasAiKey && (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Nenhuma chave de IA configurada no servidor. Contate o suporte para habilitar essa
                funcionalidade.
              </p>
            )}
            <AiAgentForm
              initialName={agent?.name ?? "IA W+"}
              initialPrompt={agent?.system_prompt ?? ""}
              initialModel={agent?.model ?? ""}
              initialEnabled={agent?.enabled ?? false}
              disabled={!hasAiKey}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p>
              Quando um lead manda mensagem no WhatsApp e o agente esta ativo, a IA responde
              sozinha usando as instrucoes definidas ao lado.
            </p>
            <p>
              Se alguem da equipe desligar as automacoes de um lead especifico (no painel de
              conversa), a IA para de responder aquele lead ate ser reativada.
            </p>
            <p>
              O agente usa as ultimas mensagens da conversa como contexto, entao ele lembra do que
              foi dito antes de responder.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
