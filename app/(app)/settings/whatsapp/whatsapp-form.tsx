"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WhatsAppAccount, WhatsAppProviderKind } from "@/lib/supabase/database.types";
import { saveWhatsAppAccount, testWhatsAppConnection } from "./actions";

export function WhatsAppForm({
  initial,
  users,
}: {
  initial: WhatsAppAccount | null;
  users: { id: string; name: string }[];
}) {
  const [provider, setProvider] = useState<WhatsAppProviderKind>(initial?.provider ?? "cloud_api");
  const [phone, setPhone] = useState(initial?.phone_number ?? "");
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  // "all" nao e um usuario: e o modo compartilhado, guardado em shared_with_all.
  const [assignedTo, setAssignedTo] = useState(
    initial?.shared_with_all ? "all" : initial?.assigned_to ?? "none",
  );
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [creds, setCreds] = useState<Record<string, string>>(
    (initial?.credentials as Record<string, string> | undefined) ?? {},
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const fields = providerFields(provider);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      try {
        await saveWhatsAppAccount({
          id: initial?.id,
          provider,
          phone_number: phone,
          display_name: displayName,
          assigned_to: assignedTo === "none" || assignedTo === "all" ? null : assignedTo,
          shared_with_all: assignedTo === "all",
          credentials: creds,
          is_active: active,
        });
        setMsg("Salvo com sucesso");
      } catch (err) {
        setMsg(formatActionError(err));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as WhatsAppProviderKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cloud_api">Meta Cloud API (oficial)</SelectItem>
              <SelectItem value="evolution">Evolution API</SelectItem>
              <SelectItem value="zapi">Z-API</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Numero de telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" required />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Nome exibido</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Responsável pelo número</Label>
          <Select value={assignedTo} onValueChange={setAssignedTo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem responsável</SelectItem>
              <SelectItem value="all">Toda a equipe (número compartilhado)</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {assignedTo === "all"
              ? "Todos os vendedores enxergam e atendem as conversas deste número — use quando a loja atende com um número só."
              : assignedTo === "none"
                ? "Ninguém responde por ele ainda. Com escopo por vendedor ligado, o número não aparece para os vendedores."
                : "Só esse vendedor enxerga as conversas deste número."}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold">Credenciais ({provider})</h3>
        {provider === "zapi" && (
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            <li>Instância conectada (QR Code) no painel Z-API</li>
            <li>Client Token em Segurança → Token de segurança da conta (ative o token)</li>
            <li>Webhook para receber: URL em Integrações → WhatsApp</li>
            <li>Ao salvar ou testar, o CRM ativa a captura das mensagens enviadas pelo WhatsApp do celular</li>
          </ul>
        )}
        {provider === "evolution" && (
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            <li>A instância precisa estar conectada no painel Evolution do cliente</li>
            <li>Ao salvar ou testar, o CRM configura o webhook para receber mensagens nessa URL</li>
            <li>Se o teste retornar desconectado, reconecte o WhatsApp pelo QR Code no painel Evolution</li>
          </ul>
        )}
        {provider === "cloud_api" && (
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            <li>Use o Phone Number ID e um token permanente com permissoes whatsapp_business_messaging e whatsapp_business_management</li>
            <li>No App Meta, configure o webhook da Cloud API com a URL exibida em Integrações → WhatsApp</li>
            <li>O WABA ID é opcional, mas permite o CRM tentar assinar os webhooks da conta automaticamente</li>
            <li>Para envio fora da janela de 24h, a Meta exige templates aprovados</li>
          </ul>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Input
                type={f.secret ? "password" : "text"}
                value={creds[f.key] ?? ""}
                onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="active"
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        <Label htmlFor="active">Conta ativa</Label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{msg ?? testMsg}</p>
        <div className="flex gap-2">
          {(provider === "zapi" || provider === "evolution" || provider === "cloud_api") && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setTestMsg(null);
                start(async () => {
                  try {
                    const r = await testWhatsAppConnection({ provider, credentials: creds });
                    setTestMsg(r.ok ? `OK - ${r.message}` : `Erro - ${r.message}`);
                  } catch (err) {
                    setTestMsg(`Erro - ${formatActionError(err)}`);
                  }
                });
              }}
            >
              Testar conexão
            </Button>
          )}
          <Button type="submit" variant="brand" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function formatActionError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("Server Components render") || message.includes("Failed to find Server Action")) {
    return "A pagina estava aberta durante uma atualizacao do CRM. Recarregue a pagina e tente novamente.";
  }
  return message;
}

function providerFields(p: WhatsAppProviderKind) {
  if (p === "cloud_api") {
    return [
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "123456789", secret: false },
      { key: "access_token", label: "Access Token", placeholder: "EAA...", secret: true },
      { key: "business_account_id", label: "WABA ID (opcional)", placeholder: "123456789", secret: false },
      { key: "graph_version", label: "Versão Graph API (opcional)", placeholder: "v20.0", secret: false },
      { key: "app_secret", label: "App Secret (opcional)", placeholder: "", secret: true },
    ];
  }
  if (p === "evolution") {
    return [
      { key: "base_url", label: "URL Base", placeholder: "https://api.evolution.example.com", secret: false },
      { key: "instance", label: "Instancia", placeholder: "minha-instancia", secret: false },
      { key: "api_key", label: "API Key", placeholder: "", secret: true },
    ];
  }
  return [
    { key: "instance_id", label: "Instance ID", placeholder: "Copie do painel Z-API → Instância", secret: false },
    { key: "token", label: "Token da instância", placeholder: "Token da URL da instância", secret: true },
    {
      key: "client_token",
      label: "Client Token (conta)",
      placeholder: "Segurança → Token de segurança da conta",
      secret: true,
    },
  ];
}
