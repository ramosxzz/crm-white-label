import Link from "next/link";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { EmailsInbox } from "./emails-inbox";

export default async function EmailsPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("google_accounts")
    .select("google_email")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  return (
    <div>
      <PageHeader eyebrow="Comunicacao" title="Emails" description="Caixa de entrada conectada ao Gmail." />

      {!account ? (
        <div className="p-8">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 p-10 text-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma conta do Gmail conectada</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Peça pra um admin conectar em Integrações para a caixa de entrada aparecer aqui.
            </p>
            <Link href="/integrations/gmail" className="text-sm text-brand underline">
              Ir para Integrações
            </Link>
          </div>
        </div>
      ) : (
        <EmailsInbox accountEmail={account.google_email} />
      )}
    </div>
  );
}
