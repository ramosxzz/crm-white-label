import type { MediaKind } from "./provider";

/**
 * Teto real de tamanho por tipo de midia no WhatsApp.
 *
 * Nao e limite nosso: e o que a rede do WhatsApp aceita, documentado pela
 * Cloud API oficial da Meta e valido tambem pro Evolution (nao-oficial),
 * porque os dois entregam pra dentro da mesma infraestrutura do WhatsApp -
 * o provedor muda como a mensagem e enviada, nao o que o WhatsApp aceita do
 * outro lado.
 *
 * Antes o limite do app era 1GB pra qualquer arquivo. Um video de celular
 * de 300-800MB passava na validacao, subia por minutos numa conexao de
 * loja, e so entao - do lado do WhatsApp - era recusado. O usuario via
 * "enviando" travado o tempo todo sem nenhum aviso de que aquele arquivo
 * jamais passaria.
 */
export const WHATSAPP_MEDIA_LIMITS_BYTES: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

const LABEL: Record<MediaKind, string> = {
  image: "Imagens",
  video: "Vídeos",
  audio: "Áudios",
  document: "Documentos",
};

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

export function mediaSizeError(kind: MediaKind, sizeBytes: number): string | null {
  const limit = WHATSAPP_MEDIA_LIMITS_BYTES[kind];
  if (sizeBytes <= limit) return null;
  return `${LABEL[kind]} até ${formatMegabytes(limit)} no WhatsApp. Este arquivo tem ${formatMegabytes(sizeBytes)} — reduza o tamanho antes de enviar.`;
}
