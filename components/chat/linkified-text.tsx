"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openLeadByPhone } from "@/app/(app)/chat/actions";
import { notifyError } from "@/lib/ui/feedback";

// Igual o WhatsApp faz com numero em texto: sequencia de digitos (com
// espacos/parenteses/traco/+ opcionais) longa o bastante pra ser telefone.
const PHONE_CANDIDATE = /(\+?\d[\d\s().-]{7,}\d)/g;

function isPlausiblePhone(digits: string) {
  return digits.length >= 10 && digits.length <= 13;
}

export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function openPhone(raw: string, key: string) {
    setLoadingKey(key);
    try {
      const { leadId } = await openLeadByPhone(raw);
      router.push(`/chat/${leadId}`);
    } catch (err) {
      notifyError(err);
    } finally {
      setLoadingKey(null);
    }
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const regex = new RegExp(PHONE_CANDIDATE);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const raw = match[0];
    const digits = raw.replace(/\D/g, "");
    if (!isPlausiblePhone(digits)) continue;

    const start = match.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));

    const itemKey = `phone-${key++}`;
    parts.push(
      <button
        key={itemKey}
        type="button"
        className="underline decoration-dotted underline-offset-2 hover:opacity-80 disabled:opacity-50"
        disabled={loadingKey === itemKey}
        onClick={(e) => {
          e.stopPropagation();
          void openPhone(raw, itemKey);
        }}
      >
        {raw}
      </button>,
    );
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <p className={className}>{parts}</p>;
}
