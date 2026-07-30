"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { confirmDialog, notify, notifyError } from "@/lib/ui/feedback";
import {
  listAdSignatures,
  saveAdSignature,
  deleteAdSignature,
  suggestUnmappedEmojis,
  type AdSignatureRow,
} from "@/app/(app)/settings/ad-signatures-actions";

type Draft = {
  emoji: string;
  matchText: string;
  creativeName: string;
  adId: string;
};

const EMPTY: Draft = { emoji: "", matchText: "", creativeName: "", adId: "" };

export function AdSignaturesPanel() {
  const [rows, setRows] = useState<AdSignatureRow[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ emoji: string; leads: number; exemplo: string }>>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    try {
      const [list, sug] = await Promise.all([listAdSignatures(), suggestUnmappedEmojis()]);
      setRows(list);
      setSuggestions(sug);
    } catch (error) {
      notifyError(error, "Nao foi possivel carregar as regras.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function submit() {
    startTransition(async () => {
      try {
        await saveAdSignature({
          emoji: draft.emoji,
          matchText: draft.matchText,
          creativeName: draft.creativeName,
          adId: draft.adId,
        });
        setDraft(EMPTY);
        notify({ title: "Criativo cadastrado", tone: "success" });
        await refresh();
      } catch (error) {
        notifyError(error, "Nao foi possivel salvar.");
      }
    });
  }

  // confirmDialog FORA da transicao: dentro dela o dialogo nunca aparecia,
  // porque o setState que o abre entrava na transicao que ficava esperando a
  // resposta dele. O clique nao fazia nada, sem erro.
  async function remove(row: AdSignatureRow) {
    const ok = await confirmDialog({
      title: `Remover "${row.creative_name}"?`,
      description: "Os leads ja atribuidos continuam como estao. Novos leads com esse emoji deixam de ser identificados.",
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteAdSignature(row.id);
        await refresh();
      } catch (error) {
        notifyError(error, "Nao foi possivel remover.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Quando o anuncio nao informa a origem, o emoji da primeira mensagem identifica o criativo.
        Cadastre um emoji por criativo. Use o campo de texto apenas quando dois criativos
        compartilharem o mesmo emoji — nesse caso, o texto desempata.
      </p>

      {suggestions.length > 0 && (
        <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Emojis vistos nos ultimos 30 dias e ainda sem criativo
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.emoji}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, emoji: s.emoji }))}
                title={s.exemplo}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:border-brand/50"
              >
                <span className="text-base leading-none">{s.emoji}</span>
                <span className="text-muted-foreground">{s.leads} leads</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[5rem_1fr_1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="sig-emoji">Emoji</Label>
          <Input
            id="sig-emoji"
            value={draft.emoji}
            onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
            placeholder="📍"
            className="text-center text-lg"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sig-name">Nome do criativo</Label>
          <Input
            id="sig-name"
            value={draft.creativeName}
            onChange={(e) => setDraft({ ...draft, creativeName: e.target.value })}
            placeholder="Curso Porto Alegre - video 01"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sig-text">Texto (opcional)</Label>
          <Input
            id="sig-text"
            value={draft.matchText}
            onChange={(e) => setDraft({ ...draft, matchText: e.target.value })}
            placeholder="Porto Alegre"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sig-ad">ID do anuncio (opcional)</Label>
          <Input
            id="sig-ad"
            value={draft.adId}
            onChange={(e) => setDraft({ ...draft, adId: e.target.value })}
            placeholder="120210..."
          />
        </div>
        <Button type="button" onClick={submit} disabled={pending || !draft.emoji || !draft.creativeName}>
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <p className="-mt-2 text-xs text-muted-foreground">
        Preencher o ID do anuncio faz a venda aparecer junto dos numeros da Meta no painel de anuncios.
        Sem ele, o criativo ainda aparece pelo nome.
      </p>

      <div className="rounded-lg border border-border">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhum criativo cadastrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 p-3">
                <span className="w-8 shrink-0 text-center text-xl leading-none">{row.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.creative_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.match_text ? `Texto: "${row.match_text}"` : "Somente pelo emoji"}
                    {row.ad_id ? ` · ID ${row.ad_id}` : " · sem ID do anuncio"}
                  </p>
                </div>
                {!row.active && <Badge variant="secondary">Inativo</Badge>}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${row.creative_name}`}
                  onClick={() => remove(row)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
