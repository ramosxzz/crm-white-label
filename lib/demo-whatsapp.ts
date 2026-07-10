const DEFAULT_DEMO_WHATSAPP = "555193730286";

export const DEMO_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_DEMO_WHATSAPP?.replace(/\D/g, "") || DEFAULT_DEMO_WHATSAPP;

export function buildDemoWhatsappUrl(message?: string) {
  const text =
    message ??
    "Ola, quero solicitar uma demo do CRM Solaire W+ e entender como funciona para minha empresa.";

  return `https://wa.me/${DEMO_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
