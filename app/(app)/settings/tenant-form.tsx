"use client";

import { notify, notifyError, confirmDialog } from "@/lib/ui/feedback";
import { useState, useTransition } from "react";
import { Boxes, Loader2, Upload, Trash2, Sparkles, Palette, PhoneCall, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tenant, MemberRole } from "@/lib/supabase/database.types";
import {
  suggestBrandColorFromName,
  tenantBrandCssVars,
} from "@/lib/theme/brand-colors";
import {
  extractDominantColorFromFile,
  extractDominantColorFromUrl,
} from "@/lib/theme/extract-logo-color";
import {
  updateTenantInfo,
  getTenantLogoPath,
  persistTenantLogoUrl,
  removeTenantLogo,
} from "./actions";

const PRESET_COLORS = [
  { name: "Verde floresta", value: "#2d6a4f" },
  { name: "Azul", value: "#2563eb" },
  { name: "Coral", value: "#e11d48" },
  { name: "Roxo", value: "#7c3aed" },
  { name: "Ambar", value: "#d97706" },
  { name: "Grafite", value: "#334155" },
  { name: "Teal", value: "#0d9488" },
  { name: "Rosa", value: "#db2777" },
];

export function TenantForm({ tenant, role }: { tenant: Tenant; role: MemberRole }) {
  const canEdit = role === "owner" || role === "admin";
  const [name, setName] = useState(tenant.name);
  const [tagline, setTagline] = useState(tenant.tagline ?? "");
  const [email, setEmail] = useState(tenant.email ?? "");
  const [phone, setPhone] = useState(tenant.phone ?? "");
  const [website, setWebsite] = useState(tenant.website ?? "");
  const [color, setColor] = useState(tenant.brand_color ?? suggestBrandColorFromName(tenant.name));
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logo_url);
  const [stockEnabled, setStockEnabled] = useState(tenant.stock_enabled);
  const [callsEnabled, setCallsEnabled] = useState(tenant.calls_dashboard_enabled);
  const [broadcastEnabled, setBroadcastEnabled] = useState(tenant.broadcast_enabled);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [colorHint, setColorHint] = useState<string | null>(null);

  const previewVars = tenantBrandCssVars(color, "light");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      try {
        await updateTenantInfo({
          name,
          tagline,
          email,
          phone,
          website,
          brand_color: color,
          stock_enabled: stockEnabled,
          calls_dashboard_enabled: callsEnabled,
          broadcast_enabled: broadcastEnabled,
        });
        setMsg("Salvo com sucesso — o tema do CRM foi atualizado.");
      } catch (err) {
        setMsg((err as Error).message);
      }
    });
  }

  function suggestFromName() {
    const suggested = suggestBrandColorFromName(name);
    setColor(suggested);
    setColorHint("Cor sugerida a partir do nome da empresa.");
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify({ title: "Logo deve ter no maximo 2MB", tone: "error" });
      return;
    }
    setUploading(true);
    try {
      let extracted = await extractDominantColorFromFile(file);
      const supabase = createClient();
      const prefix = await getTenantLogoPath();
      const ext = file.name.split(".").pop() || "png";
      const path = `${prefix}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-logos")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("tenant-logos").getPublicUrl(path);
      const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;

      if (!extracted) {
        extracted = await extractDominantColorFromUrl(publicUrl);
      }
      const finalColor = extracted ?? suggestBrandColorFromName(name);

      await persistTenantLogoUrl(publicUrl.split("?")[0], finalColor);
      setLogoUrl(publicUrl.split("?")[0]);
      setColor(finalColor);

      if (extracted) {
        setColorHint("Cor extraída da logo e aplicada ao tema automaticamente.");
      } else {
        setColorHint(
          "Não foi possível ler a cor da imagem — aplicamos uma sugestão pelo nome da empresa. Ajuste se quiser.",
        );
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onRemoveLogo() {
    if (!(await confirmDialog({ title: "Remover logo?", tone: "danger", confirmLabel: "Remover" }))) return;
    await removeTenantLogo();
    setLogoUrl(null);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div
        className="rounded-xl border border-border/60 p-4"
        style={
          {
            borderColor: `hsl(${previewVars["--brand"] ?? "150 42% 32%"})`,
            background: `linear-gradient(135deg, hsl(${previewVars["--brand-muted"] ?? "150 22% 93%"} / 0.5), transparent)`,
          } as React.CSSProperties
        }
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview do tema</p>
        <div className="mt-3 flex items-center gap-3">
          <div
            className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="font-display text-lg font-semibold">{name || "Sua empresa"}</p>
            <p className="text-sm text-muted-foreground">{tagline || "Slogan da empresa"}</p>
          </div>
          <Button type="button" size="sm" variant="brand" className="ml-auto pointer-events-none">
            Botao marca
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-muted" data-slot="logo-preview">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-xl font-semibold text-muted-foreground">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Logo da empresa</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG ou JPG quadrado, ate 2MB. A cor da marca pode ser lida automaticamente da imagem.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label>
              <input type="file" className="hidden" accept="image/*" onChange={onUpload} disabled={!canEdit || uploading} />
              <Button asChild variant="outline" size="sm" disabled={!canEdit || uploading}>
                <span>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? "Enviando..." : "Enviar logo"}
                </span>
              </Button>
            </label>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={onRemoveLogo} disabled={!canEdit}>
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da empresa</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email de contato</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} placeholder="contato@suaempresa.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} placeholder="(11) 99999-9999" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Site</Label>
          <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!canEdit} placeholder="https://" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="tagline">Slogan / Descricao curta</Label>
          <Textarea id="tagline" rows={2} value={tagline} onChange={(e) => setTagline(e.target.value)} disabled={!canEdit} placeholder="Aparece abaixo do nome no menu lateral" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Cor da marca</Label>
          {canEdit && (
            <Button type="button" variant="ghost" size="sm" onClick={suggestFromName}>
              <Sparkles className="h-3.5 w-3.5" />
              Sugerir pelo nome
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={!canEdit}
              onClick={() => {
                setColor(c.value);
                setColorHint(null);
              }}
              className="group flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs transition-all hover:border-foreground/30 disabled:cursor-not-allowed"
              style={color === c.value ? { borderColor: c.value, boxShadow: `0 0 0 1px ${c.value}40` } : undefined}
            >
              <span className="h-4 w-4 rounded-md ring-1 ring-border" style={{ backgroundColor: c.value }} />
              {c.name}
            </button>
          ))}
          <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setColorHint(null);
              }}
              disabled={!canEdit}
              className="h-4 w-4 cursor-pointer rounded-md border-0 bg-transparent p-0"
            />
            Personalizar
          </label>
        </div>
        {colorHint && <p className="text-xs text-brand">{colorHint}</p>}
        <p className="text-xs text-muted-foreground">
          A cor e aplicada em botoes, destaques do menu, anel de foco e bolhas de mensagem enviada no chat.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Boxes className="h-4 w-4" />
            </span>
            <div>
              <Label htmlFor="stock-enabled" className="text-sm font-semibold">
                Modulo de estoque
              </Label>
              <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                Mostra o menu Estoque, os indicadores no dashboard e libera cadastro de produtos e reservas para esta empresa.
              </p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium">
            <span className={stockEnabled ? "text-brand" : "text-muted-foreground"}>
              {stockEnabled ? "Ativo" : "Desativado"}
            </span>
            <input
              id="stock-enabled"
              type="checkbox"
              className="peer sr-only"
              checked={stockEnabled}
              onChange={(e) => setStockEnabled(e.target.checked)}
              disabled={!canEdit}
            />
            <span className="relative h-6 w-11 rounded-full bg-muted ring-1 ring-border transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-60" />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <PhoneCall className="h-4 w-4" />
            </span>
            <div>
              <Label htmlFor="calls-enabled" className="text-sm font-semibold">
                Modulo de ligacoes
              </Label>
              <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                Mostra o menu Ligacoes, o dashboard de chamadas, o botao de ligar pelo ramal e os
                indicadores de tentativas de ligacao no Kanban e no Chat para esta empresa.
              </p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium">
            <span className={callsEnabled ? "text-brand" : "text-muted-foreground"}>
              {callsEnabled ? "Ativo" : "Desativado"}
            </span>
            <input
              id="calls-enabled"
              type="checkbox"
              className="peer sr-only"
              checked={callsEnabled}
              onChange={(e) => setCallsEnabled(e.target.checked)}
              disabled={!canEdit}
            />
            <span className="relative h-6 w-11 rounded-full bg-muted ring-1 ring-border transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-60" />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Megaphone className="h-4 w-4" />
            </span>
            <div>
              <Label htmlFor="broadcast-enabled" className="text-sm font-semibold">
                Modulo de disparo
              </Label>
              <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                Mostra o menu Disparos, para enviar uma mensagem (texto ou mensagem rapida) para
                varios leads de uma vez, com intervalo configuravel entre os envios.
              </p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium">
            <span className={broadcastEnabled ? "text-brand" : "text-muted-foreground"}>
              {broadcastEnabled ? "Ativo" : "Desativado"}
            </span>
            <input
              id="broadcast-enabled"
              type="checkbox"
              className="peer sr-only"
              checked={broadcastEnabled}
              onChange={(e) => setBroadcastEnabled(e.target.checked)}
              disabled={!canEdit}
            />
            <span className="relative h-6 w-11 rounded-full bg-muted ring-1 ring-border transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-60" />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-4">
        <p className="text-sm text-muted-foreground">{msg}</p>
        <Button type="submit" variant="brand" disabled={!canEdit || pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            "Salvar alteracoes"
          )}
        </Button>
      </div>
    </form>
  );
}
