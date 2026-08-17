"use client";

import { useState } from "react";
import { LeadTagPicker } from "@/components/leads/lead-tag-picker";
import { updateChatLeadTags } from "@/app/(app)/chat/actions";
import { notifyError } from "@/lib/ui/feedback";

export function LeadTagsPanel({
  leadId,
  initialTags,
  catalog,
}: {
  leadId: string;
  initialTags: string[];
  catalog: string[];
}) {
  const [tags, setTags] = useState(initialTags);
  const [options, setOptions] = useState(catalog);
  const [saving, setSaving] = useState(false);

  function save(next: string[]) {
    const previous = tags;
    setTags(next);
    setSaving(true);
    void updateChatLeadTags({ leadId, tags: next })
      .then((result) => {
        setTags(result.tags);
        setOptions((current) => Array.from(new Set([...current, ...result.tags])));
      })
      .catch((error) => {
        setTags(previous);
        notifyError(error);
      })
      .finally(() => setSaving(false));
  }

  return <LeadTagPicker value={tags} options={options} onChange={save} disabled={saving} />;
}
