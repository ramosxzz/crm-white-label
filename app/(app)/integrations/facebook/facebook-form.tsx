"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateTenantMetaSettings } from "@/app/(app)/settings/actions";
import { Chrome, HelpCircle, Save, CheckCircle } from "lucide-react";

interface FacebookFormProps {
  initialData: {
    meta_pixel_id?: string | null;
    meta_capi_token?: string | null;
    meta_ad_account_id?: string | null;
    meta_ads_access_token?: string | null;
  };
}

export function FacebookForm({ initialData }: FacebookFormProps) {
  const [pixelId, setPixelId] = useState(initialData.meta_pixel_id || "");
  const [capiToken, setCapiToken] = useState(initialData.meta_capi_token || "");
  const [adAccountId, setAdAccountId] = useState(initialData.meta_ad_account_id || "");
  const [adsToken, setAdsToken] = useState(initialData.meta_ads_access_token || initialData.meta_capi_token || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError("");

    try {
      await updateTenantMetaSettings({
        meta_pixel_id: pixelId,
        meta_capi_token: capiToken,
        meta_ad_account_id: adAccountId,
        meta_ads_access_token: adsToken,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar as configurações.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Integração"
        title="Meta Ads & Conversões (CAPI)"
        backHref="/integrations"
        description="Configure o seu Pixel e API de Conversões para rastreamento inteligente de vendas e ROAS no WhatsApp."
      />
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <form onSubmit={handleSave}>
          <Card className="shadow-lg border border-border/80">
            <CardHeader className="border-b border-border/50 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
                  <Chrome className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Configurações de Anúncios e Atribuição</CardTitle>
                  <CardDescription>
                    Qualquer cliente seu que clique nos seus anúncios de WhatsApp será rastreado, e as vendas do CRM serão enviadas de volta para o seu Pixel do Meta automaticamente.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {success && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-sm font-medium">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  Configurações salvas com sucesso! O rastreamento dinâmico já está ativo.
                </div>
              )}

              {error && (
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="pixel-id" className="text-sm font-semibold flex items-center gap-1.5">
                  ID do Pixel do Meta
                  <span className="text-xs text-muted-foreground font-normal">(Identificação do Dataset)</span>
                </Label>
                <Input
                  id="pixel-id"
                  placeholder="Ex: 951173883458808"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Encontrado na aba "Fontes de dados" no Gerenciador de Eventos do Meta.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capi-token" className="text-sm font-semibold flex items-center gap-1.5">
                  Token de Acesso da API de Conversões (CAPI)
                </Label>
                <textarea
                  id="capi-token"
                  rows={4}
                  placeholder="Cole aqui o token de acesso de longa duração gerado no Meta (começa com EAA...)"
                  value={capiToken}
                  onChange={(e) => setCapiToken(e.target.value)}
                  className="w-full font-mono text-xs rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Gerado na aba "Configurações" do seu Pixel, dentro da seção "API de Conversões" no painel do Meta.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ad-account-id" className="text-sm font-semibold flex items-center gap-1.5">
                  ID da Conta de Anúncios (Opcional)
                </Label>
                <Input
                  id="ad-account-id"
                  placeholder="Ex: 123456789"
                  value={adAccountId}
                  onChange={(e) => setAdAccountId(e.target.value)}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Necessário para a dashboard puxar o custo dos seus anúncios e calcular o ROAS automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ads-token" className="text-sm font-semibold flex items-center gap-1.5">
                  Token da Marketing API para leitura de anúncios
                </Label>
                <textarea
                  id="ads-token"
                  rows={4}
                  placeholder="Cole um token com permissao ads_read para listar campanhas, anúncios e custos"
                  value={adsToken}
                  onChange={(e) => setAdsToken(e.target.value)}
                  className="w-full font-mono text-xs rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" />
                  O dashboard precisa de um token da Marketing API com ads_read ou ads_management gerado por alguem com acesso a conta de anuncios.
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button type="submit" disabled={loading} className="gap-2 px-6">
                  <Save className="h-4 w-4" />
                  {loading ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
