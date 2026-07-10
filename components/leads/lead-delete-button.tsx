"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteLead } from "@/app/(app)/leads/actions";

export function LeadDeleteButton({
  leadId,
  leadName,
  redirectTo = "/leads",
  variant = "outline",
  size = "sm",
  iconOnly = false,
}: {
  leadId: string;
  leadName: string;
  redirectTo?: string;
  variant?: "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "icon";
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      className={variant === "outline" ? "text-destructive hover:bg-destructive/10" : undefined}
      title="Excluir lead"
      onClick={() => {
        if (
          !confirm(
            `Excluir o lead "${leadName}"? Conversas e mensagens serao removidas. Esta acao nao pode ser desfeita.`,
          )
        ) {
          return;
        }
        start(async () => {
          try {
            await deleteLead(leadId);
            router.push(redirectTo);
            router.refresh();
          } catch (e) {
            alert((e as Error).message);
          }
        });
      }}
    >
      <Trash2 className="h-4 w-4" />
      {!iconOnly && (pending ? "Excluindo..." : "Excluir lead")}
    </Button>
  );
}
