export const CHAT_COMPOSER_MAX_HEIGHT_PX = 128;

export function resizeChatComposer(
  textarea: HTMLTextAreaElement,
  maxHeight = CHAT_COMPOSER_MAX_HEIGHT_PX,
): void {
  textarea.style.height = "0px";
  const contentHeight = textarea.scrollHeight;
  textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`;
  textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
}
