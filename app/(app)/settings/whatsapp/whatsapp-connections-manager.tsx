"use client";

import { confirmDialog } from "@/lib/ui/feedback";
import { useMemo, useState, useTransition } from "react";
import { ExternalLink, MessageCircle, Plus, Power, Settings, Smartphone, Trash2, UserRound, Wifi, WifiOff } from "lucide-react";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { deleteWhatsAppAccount, setWhatsAppAccountActive } from "./actions";
import { WhatsAppForm } from "./whatsapp-form";

type Account = WhatsAppAccount;
type UserOption = { id: string; name: string };

const providerMeta = {
  cloud_api: {
    title: "WhatsApp Cloud (Oficial)",
    channel: "WhatsApp",
    host: "whatsapp.com",
    href: "https://business.facebook.com/wa/manage/phone-numbers/",
    description: "Plataforma oficial do WhatsApp para troca de mensagens e arquivos.",
  },
  evolution: {
    title: "Evolution API",
    channel: "WhatsApp",
    host: "doc.evolution-api.com",
    href: "https://doc.evolution-api.com/",
    description: "API de terceiros para automacao de mensagens no WhatsApp.",
  },
  zapi: {
    title: "Z-API",
    channel: "WhatsApp",
    host: "z-api.io",
    href: "https://www.z-api.io/",
    description: "API de terceiros para atendimento e automacao com WhatsApp.",
  },
} as const;

export function WhatsAppConnectionsManager({ accounts, users = [] }: { accounts: Account[]; users?: UserOption[] }) {
  const [selected, setSelected] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => Number(b.is_active) - Number(a.is_active)),
    [accounts],
  );

  function toggle(account: Account) {
    setMessage(null);
    setPendingId(account.id);
    startTransition(async () => {
      try {
        await setWhatsAppAccountActive({ id: account.id, is_active: !account.is_active });
      } catch (err) {
        setMessage((err as Error).message);
      } finally {
        setPendingId(null);
      }
    });
  }

  async function remove(account: Account) {
    const label = account.display_name || account.phone_number;
    const confirmed = await confirmDialog({
      title: `Excluir a conexao ${label}?`,
      description: "As conversas antigas ficam salvas, mas este numero deixa de enviar mensagens.",
      tone: "danger",
      confirmLabel: "Excluir",
    });
    if (!confirmed) return;
    setMessage(null);
    setPendingId(account.id);
    startTransition(async () => {
      try {
        await deleteWhatsAppAccount({ id: account.id });
      } catch (err) {
        setMessage((err as Error).message);
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-normal">Conexoes</h2>
          <p className="text-sm text-muted-foreground">Gerencie as contas de WhatsApp conectadas ao CRM.</p>
        </div>
        <Button variant="brand" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Criar
        </Button>
      </div>

      {message && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </div>
      )}

      {sortedAccounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-6 py-12 text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Nenhuma conexao configurada</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie uma conexao para enviar e receber mensagens.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedAccounts.map((account) => (
            <ConnectionCard
              key={account.id}
              account={account}
              busy={isPending && pendingId === account.id}
              onManage={() => setSelected(account)}
              onToggle={() => toggle(account)}
              onDelete={() => remove(account)}
              users={users}
            />
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova conexao WhatsApp</DialogTitle>
            <DialogDescription>Cadastre uma nova conta para atendimento.</DialogDescription>
          </DialogHeader>
          <WhatsAppForm key="new" initial={null} users={users} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar conexao</DialogTitle>
            <DialogDescription>Altere credenciais, numero e status da conta.</DialogDescription>
          </DialogHeader>
          {selected && <WhatsAppForm key={selected.id} initial={selected} users={users} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConnectionCard({
  account,
  busy,
  onManage,
  onToggle,
  onDelete,
  users,
}: {
  account: Account;
  busy: boolean;
  onManage: () => void;
  onToggle: () => void;
  onDelete: () => void;
  users: UserOption[];
}) {
  const meta = providerMeta[account.provider];
  const credentials = (account.credentials ?? {}) as Record<string, unknown>;
  const synced = typeof credentials.webhooks_synced_at === "string";
  const status = !account.is_active ? "disabled" : synced ? "connected" : "unstable";
  const assignedUser = account.assigned_to ? users.find((user) => user.id === account.assigned_to) : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <Badge
            variant={status === "connected" ? "success" : status === "disabled" ? "outline" : "warning"}
            className="rounded-full"
          >
            {status === "connected" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {status === "connected" ? "Conectado" : status === "disabled" ? "Desativado" : "Instavel"}
          </Badge>
          <a
            href={meta.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {meta.host}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold tracking-normal">{meta.title}</h3>
            <p className="text-sm text-muted-foreground">{meta.channel}</p>
          </div>
        </div>

        <div className="min-h-[84px] space-y-1">
          <p className="truncate text-sm font-semibold">{account.display_name || account.phone_number}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
          <p className="font-mono text-xs text-muted-foreground">{account.phone_number}</p>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
            {account.shared_with_all
              ? "Número da equipe: todos atendem"
              : assignedUser
                ? `Responsavel: ${assignedUser.name}`
                : "Sem responsavel atribuido"}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onManage}>
              <Settings className="h-4 w-4" />
              Gerenciar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={busy}
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Excluir conexao"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className={cn(
              "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors disabled:opacity-60",
              account.is_active
                ? "border-brand bg-brand"
                : "border-border bg-muted",
            )}
            aria-label={account.is_active ? "Desativar conexao" : "Ativar conexao"}
            title={account.is_active ? "Desativar conexao" : "Ativar conexao"}
          >
            <span
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-muted-foreground shadow transition-transform",
                account.is_active ? "translate-x-5" : "translate-x-1",
              )}
            >
              <Power className="h-3 w-3" />
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
