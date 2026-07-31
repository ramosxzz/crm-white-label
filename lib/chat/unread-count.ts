export function nextConversationUnreadCount(
  currentUnread: number | null | undefined,
  direction: "inbound" | "outbound",
): number {
  if (direction === "outbound") return 0;
  return Math.max(0, currentUnread ?? 0) + 1;
}
