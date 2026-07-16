"use client";

import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CallButton({ leadId, phone, iconOnly = false }: { leadId?: string | null; phone: string; iconOnly?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleCall() {
    setPending(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/integrations/api4com/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: leadId || undefined, phone }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao iniciar ligacao");
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <Button variant="outline" size={iconOnly ? "icon" : "default"} onClick={handleCall} disabled={pending} title="Ligar via Api4com">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
        {!iconOnly && "Ligar"}
      </Button>
      {done && (
        <p className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-emerald-500/40 bg-card p-2 text-xs text-emerald-600 shadow-md">
          Ligação disparada. Se nada tocar, confira se a extensão/Webphone da Api4com está instalada e logada (ícone verde &quot;online&quot;) no seu navegador.
        </p>
      )}
      {error && (
        <p className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-destructive/40 bg-card p-2 text-xs text-destructive shadow-md">
          {error}
        </p>
      )}
    </div>
  );
}
