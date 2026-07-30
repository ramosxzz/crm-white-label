type SearchableConversation = {
  leadName: string;
  leadSubtitle: string;
  leadPhone: string;
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchesConversationSearch(
  conversation: SearchableConversation,
  query: string,
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const textQuery = normalizeSearchText(trimmed);
  const phoneQuery = trimmed.replace(/\D/g, "");

  return (
    normalizeSearchText(conversation.leadName).includes(textQuery) ||
    normalizeSearchText(conversation.leadSubtitle).includes(textQuery) ||
    (phoneQuery.length > 0 &&
      conversation.leadPhone.replace(/\D/g, "").includes(phoneQuery))
  );
}
