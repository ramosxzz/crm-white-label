"use client";

import { confirmDialog } from "@/lib/ui/feedback";
import { useMemo, useState, useTransition } from "react";
import { Loader2, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";

import type { MemberRole } from "@/lib/supabase/database.types";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTeamUser,
  removeTeamUser,
  updateTeamUserRole,
  type TeamUser,
} from "./actions";

const roleOptions: Array<{ value: MemberRole; label: string; description: string }> = [
  { value: "admin", label: "Admin", description: "Configura empresa, integracoes e equipe." },
  { value: "gerente", label: "Gerente", description: "Acompanha operacao e leads do time." },
  { value: "atendente", label: "Atendente", description: "Atende conversas e movimenta leads." },
  { value: "vendedor", label: "Vendedor", description: "Opera leads e atendimentos do dia a dia." },
];

function roleLabel(role: MemberRole) {
  if (role === "owner") return "Proprietario";
  return roleOptions.find((item) => item.value === role)?.label ?? role;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(value),
  );
}

export function UsersManager({
  users,
  canManage,
}: {
  users: TeamUser[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "atendente",
  });

  const counts = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc[user.role] = (acc[user.role] ?? 0) + 1;
        return acc;
      },
      {} as Partial<Record<MemberRole, number>>,
    );
  }, [users]);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createTeamUser(form);
        setForm({ fullName: "", email: "", password: "", role: "atendente" });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nao foi possivel criar o usuario");
      }
    });
  }

  function changeRole(userId: string, role: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTeamUserRole({ userId, role });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nao foi possivel alterar o cargo");
      }
    });
  }

  async function removeUser(user: TeamUser) {
    const confirmed = await confirmDialog({
      title: `Remover ${user.fullName} desta empresa?`,
      description: "A pessoa perde o acesso ao CRM desta empresa.",
      tone: "danger",
      confirmLabel: "Remover",
    });
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeTeamUser(user.userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nao foi possivel remover o usuario");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-normal">Usuarios</h2>
          <p className="text-sm text-muted-foreground">
            Controle quem acessa o CRM e identifique atendentes nas conversas.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!canManage}>
          <UserPlus className="mr-2 h-4 w-4" />
          Criar usuario
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {roleOptions.map((role) => (
          <Card key={role.value} className="border-border/70 bg-card/70">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{role.label}</p>
              <p className="mt-1 text-2xl font-semibold">{counts[role.value] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[minmax(220px,1fr)_160px_190px_80px] gap-3 border-b border-border bg-muted/25 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Usuario</span>
          <span>Cargo</span>
          <span>Entrada</span>
          <span className="text-right">Acoes</span>
        </div>
        <div className="divide-y divide-border">
          {users.map((user) => {
            const locked = !canManage || user.isCurrentUser || user.role === "owner";
            return (
              <div
                key={user.userId}
                className="grid grid-cols-[minmax(220px,1fr)_160px_190px_80px] items-center gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
                    {initials(user.fullName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{user.fullName}</p>
                      {user.isCurrentUser && <Badge variant="secondary">Voce</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{user.email || "E-mail indisponivel"}</p>
                  </div>
                </div>

                {user.role === "owner" ? (
                  <Badge className="w-fit gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {roleLabel(user.role)}
                  </Badge>
                ) : (
                  <Select value={user.role} onValueChange={(value) => changeRole(user.userId, value)} disabled={locked || pending}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <span className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</span>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8 text-muted-foreground", !locked && "hover:text-destructive")}
                    disabled={locked || pending}
                    onClick={() => removeUser(user)}
                    aria-label="Remover usuario"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-muted-foreground">
              <Users className="mb-3 h-8 w-8" />
              <p className="text-sm">Nenhum usuario cadastrado nesta empresa.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar usuario</DialogTitle>
            <DialogDescription>
              A pessoa entra direto nesta empresa e as mensagens enviadas por ela ficam identificadas no chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="Nome do atendente"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">E-mail</label>
              <Input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="email@empresa.com"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Senha temporaria</label>
              <PasswordInput
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Minimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Cargo</label>
              <Select value={form.role} onValueChange={(role) => setForm((prev) => ({ ...prev, role }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roleOptions.find((role) => role.value === form.role)?.description}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
