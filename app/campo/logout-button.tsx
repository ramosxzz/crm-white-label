"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { pendingCount } from "@/lib/field-service/offline";
import { confirmDialog, notifyError } from "@/lib/ui/feedback";

/**
 * Sair do app de campo. O tecnico e redirecionado pra ca no login e nunca passa
 * pelo CRM, entao sem esse botao ele fica preso na tela: nao ha sidebar nem
 * barra inferior aqui, que e onde mora o "Sair" do resto do sistema.
 *
 * Confirma antes quando ainda ha registro na fila offline. A fila vive no
 * IndexedDB do aparelho e esta amarrada a sessao: sair sem enviar deixa
 * assinatura e upsell parados no celular, sem ninguem pra subir por ele.
 */
export function LogoutButton() {
  const [leaving, setLeaving] = useState(false);

  async function handleLogout() {
    setLeaving(true);
    try {
      const pending = await pendingCount();
      const confirmed = await confirmDialog(
        pending > 0
          ? {
              title: `Sair com ${pending} registro(s) por enviar?`,
              description:
                'O que voce registrou ainda esta so neste aparelho. Conecte-se e espere aparecer "Tudo enviado" antes de sair, senao esses dados se perdem.',
              confirmLabel: "Sair mesmo assim",
              cancelLabel: "Ficar",
              tone: "danger",
            }
          : {
              title: "Sair do app de campo?",
              description: "Voce vai precisar entrar de novo pra ver as OS do dia.",
              confirmLabel: "Sair",
              cancelLabel: "Cancelar",
            },
      );
      if (!confirmed) return;

      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      notifyError(error, "Nao foi possivel sair.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={leaving}
      aria-label="Sair"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
