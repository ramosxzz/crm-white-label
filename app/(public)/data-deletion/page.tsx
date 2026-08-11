import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Exclusão de dados | Solaire W+ CRM",
  description: "Instruções e acompanhamento de solicitações de exclusão de dados da Meta.",
};

const CONTACT_EMAIL = "solairew3@gmail.com";

const STATUS_LABELS: Record<string, string> = {
  pending: "Solicitação recebida",
  in_progress: "Exclusão em processamento",
  completed: "Exclusão concluída",
  rejected: "Solicitação encerrada",
};

export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  let requestStatus: string | null = null;
  let requestedAt: string | null = null;

  if (code) {
    // A migration desta feature e aplicada antes da proxima regeneracao dos tipos.
    // O cast fica restrito a esta tabela e pode ser removido apos `supabase:types`.
    const supabase = createServiceClient() as any;
    const { data } = await supabase
      .from("meta_data_deletion_requests")
      .select("status, requested_at")
      .eq("confirmation_code", code)
      .maybeSingle();

    requestStatus = data?.status ?? null;
    requestedAt = data?.requested_at ?? null;
  }

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>Exclusão de dados da Meta</h1>

      {code && (
        <section className="not-prose mb-10 rounded-xl border bg-muted/30 p-5">
          <p className="text-sm font-semibold">Status da solicitação</p>
          <p className="mt-2 text-lg font-semibold">
            {requestStatus ? STATUS_LABELS[requestStatus] ?? requestStatus : "Código não encontrado"}
          </p>
          {requestedAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Recebida em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(requestedAt))}.
            </p>
          )}
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{code}</p>
        </section>
      )}

      <p>
        Você pode solicitar a exclusão dos Dados da Plataforma da Meta tratados pelo Solaire W+
        CRM, incluindo dados associados às integrações com WhatsApp Business e Instagram.
      </p>

      <h2>Como solicitar</h2>
      <ol>
        <li>Desconecte a conta da Meta na área de integrações do CRM, quando essa opção estiver disponível.</li>
        <li>
          Envie um e-mail para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> usando o
          endereço cadastrado no CRM.
        </li>
        <li>Informe o nome da empresa, o número do WhatsApp Business ou a conta do Instagram conectada e declare que deseja excluir os dados da integração.</li>
      </ol>

      <h2>O que acontece depois</h2>
      <p>
        Confirmaremos a identidade e a autorização do solicitante, revogaremos ou removeremos as
        credenciais da integração e excluiremos os Dados da Plataforma da Meta associados, salvo
        quando a retenção for necessária para cumprir uma obrigação legal. A solicitação será
        concluída em até 30 dias após a validação.
      </p>

      <p>
        Solicitações iniciadas diretamente pela Meta recebem um código de confirmação e podem ser
        acompanhadas nesta página.
      </p>
    </article>
  );
}
