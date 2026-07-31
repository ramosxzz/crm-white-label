import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintOnOpen } from "./print-on-open";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import {
  canAccessConversationAccount,
  getChatAccountVisibility,
} from "@/lib/chat/list-conversation-items";
import { displayLeadName } from "@/lib/leads/display";

function when(value: string) {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function mediaLabel(type: string | null) {
  if (!type) return null;
  if (type === "image") return "Imagem anexada";
  if (type === "video") return "Vídeo anexado";
  if (type === "audio") return "Áudio anexado";
  return "Documento anexado";
}

export default async function ConversationExportPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const ctx = await requireContext();
  const service = createServiceClient();
  const { data: leadData } = await service
    .from("leads")
    .select("id, name, phone")
    .eq("id", leadId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  const lead = leadData as { id: string; name: string; phone: string | null } | null;
  if (!lead) notFound();

  const { data: conversationData } = await service
    .from("conversations")
    .select("id, whatsapp_account_id, channel")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", leadId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const conversation = conversationData as {
    id: string;
    whatsapp_account_id: string | null;
    channel: string;
  } | null;
  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  if (
    conversation &&
    !canAccessConversationAccount(conversation.whatsapp_account_id, visibility)
  ) {
    notFound();
  }

  const { data: messages } = conversation
    ? await service
        .from("messages")
        .select("id, direction, body, media_type, created_at")
        .eq("tenant_id", ctx.tenantId)
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(2_000)
    : { data: [] };

  const title = displayLeadName(lead.name, lead.phone);
  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-slate-950 sm:px-10 print:max-w-none print:px-0 print:py-0">
      <header className="mb-8 border-b border-slate-200 pb-5">
        <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
          <Link href={`/chat/${leadId}`} className="text-sm text-slate-600 hover:text-slate-950">Voltar à conversa</Link>
          <PrintOnOpen />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Histórico de atendimento</p>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        {lead.phone && <p className="mt-1 text-sm text-slate-600">{lead.phone}</p>}
        <p className="mt-3 text-xs text-slate-500">Gerado em {when(new Date().toISOString())} · {ctx.tenant.name}</p>
      </header>

      {(messages ?? []).length === 0 ? (
        <p className="text-sm text-slate-600">Nenhuma mensagem registrada nesta conversa.</p>
      ) : (
        <ol className="space-y-3">
          {(messages ?? []).map((message: any) => {
            const outgoing = message.direction === "outbound";
            return (
              <li key={message.id} className={`break-inside-avoid rounded-lg border p-3 ${outgoing ? "border-brand/30 bg-brand/5" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <strong>{outgoing ? "Equipe" : title}</strong>
                  <time className="shrink-0 text-slate-500">{when(message.created_at)}</time>
                </div>
                {message.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>}
                {mediaLabel(message.media_type) && <p className="mt-2 text-xs italic text-slate-500">[{mediaLabel(message.media_type)}]</p>}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
