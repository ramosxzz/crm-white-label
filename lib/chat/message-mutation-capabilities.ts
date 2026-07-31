import type { WhatsAppProviderKind } from "@/lib/supabase/database.types";

export function messageMutationCapabilities(provider: WhatsAppProviderKind | null | undefined) {
  return {
    canEdit: provider === "evolution",
    canDelete: provider === "evolution" || provider === "zapi",
  };
}
