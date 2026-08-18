import Link from "next/link";
import {
  MessageCircle,
  Instagram,
  Facebook,
  ChevronRight,
  CheckCircle2,
  Circle,
  KeyRound,
  Mail,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageIntegrations } from "@/lib/auth/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";

export default async function IntegrationsPage() {
  const ctx = await requireContext();
  if (!canManageIntegrations(ctx.role)) redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: wppAccounts }, { data: tenant }, { data: igAccount }, { data: apiKeys }, { data: googleAccount }] = await Promise.all([
    supabase.from("whatsapp_accounts").select("id, is_active").eq("tenant_id", ctx.tenantId).eq("is_active", true).limit(1),
    supabase.from("tenants").select("meta_pixel_id").eq("id", ctx.tenantId).single(),
    supabase.from("instagram_accounts").select("id, is_active").eq("tenant_id", ctx.tenantId).maybeSingle(),
    supabase.from("api_keys").select("id").eq("tenant_id", ctx.tenantId).eq("is_active", true).limit(1),
    supabase.from("google_accounts").select("id").eq("tenant_id", ctx.tenantId).maybeSingle(),
  ]);

  const wppOn = (wppAccounts?.length ?? 0) > 0;
  const metaOn = !!tenant?.meta_pixel_id;
  const igOn = !!igAccount?.is_active;
  const apiOn = (apiKeys?.length ?? 0) > 0;
  const gmailOn = !!googleAccount;

  const items = [
    {
      key: "whatsapp",
      title: "WhatsApp",
      description:
        "Atenda e venda pelo WhatsApp com chat ao vivo e envio de mídia. Cloud API oficial, Evolution ou Z-API.",
      icon: MessageCircle,
      href: "/integrations/whatsapp",
      status: wppOn,
      gradient: "from-emerald-500 to-green-600",
      tags: ["Cloud API", "Evolution", "Z-API"],
    },
    {
      key: "instagram",
      title: "Instagram Direct",
      description:
        "Capture leads das DMs do Instagram automaticamente e responda tudo dentro do CRM.",
      icon: Instagram,
      href: "/integrations/instagram",
      status: igOn,
      gradient: "from-purple-500 via-pink-500 to-orange-400",
      tags: ["Meta", "DM", "Leads"],
    },
    {
      key: "facebook",
      title: "Meta Ads & Pixel",
      description:
        "Pixel e API de Conversões da Meta para rastrear vendas, otimizar campanhas e medir ROAS.",
      icon: Facebook,
      href: "/integrations/facebook",
      status: metaOn,
      gradient: "from-blue-500 to-indigo-600",
      tags: ["Pixel", "Conversions API", "ROAS"],
    },
    {
      key: "gmail",
      title: "Gmail",
      description:
        "Veja os emails trocados com cada lead direto na ficha dele, sem sair do CRM.",
      icon: Mail,
      href: "/integrations/gmail",
      status: gmailOn,
      gradient: "from-red-500 to-orange-400",
      tags: ["Leitura", "Leads"],
    },
    {
      key: "api",
      title: "API",
      description:
        "Conecte o CRM a ERPs, sites e ferramentas de automação com uma chave de API por tenant.",
      icon: KeyRound,
      href: "/integrations/api",
      status: apiOn,
      gradient: "from-slate-600 to-slate-800",
      tags: ["Leads", "Mensagens", "Webhooks"],
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Canais"
        title="Integrações"
        description="Conecte WhatsApp, Instagram e Meta para que os leads cheguem e sejam atendidos automaticamente."
      />
      <div className="grid gap-5 p-8 md:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.key} href={it.href} prefetch>
              <Card className="group relative h-full overflow-hidden transition-all hover:border-brand/40 hover:shadow-elev-2">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${it.gradient} text-white shadow-md`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {it.status ? (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3" /> Conectado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Circle className="h-3 w-3" /> Inativo
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-semibold">{it.title}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{it.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {it.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-end text-xs font-medium text-muted-foreground transition-colors group-hover:text-brand">
                    Configurar <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="px-8 pb-8">
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Webhooks e APIs externas</span> agora ficam nas{" "}
          <Link href="/automations" className="text-brand hover:underline" prefetch>
            Automações
          </Link>{" "}
          — use o bloco <span className="font-medium">API</span> para integrar com qualquer serviço (Zapier, n8n, sistemas próprios).
        </div>
      </div>
    </div>
  );
}
