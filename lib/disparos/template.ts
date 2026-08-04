import { dayGreeting } from "@/lib/whatsapp/day-greeting";

export type TemplateLead = {
  name: string | null;
  phone: string | null;
  email?: string | null;
  source?: string | null;
};

const VARIABLES_HELP = [
  { key: "{{name}}", label: "Nome completo" },
  { key: "{{first_name}}", label: "Primeiro nome" },
  { key: "{{phone}}", label: "Telefone" },
  { key: "{{email}}", label: "E-mail" },
  { key: "{{source}}", label: "Origem do lead" },
  { key: "{{day_greeting}}", label: "Bom dia / Boa tarde / Boa noite (conforme o horário do envio)" },
] as const;

export function templateVariablesHelp() {
  return VARIABLES_HELP;
}

function firstName(full: string | null | undefined): string {
  const t = (full ?? "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? t;
}

export function renderMessageTemplate(bodyTemplate: string, lead: TemplateLead): string {
  return bodyTemplate
    .replace(/\{\{name\}\}/gi, lead.name?.trim() ?? "")
    .replace(/\{\{first_name\}\}/gi, firstName(lead.name))
    .replace(/\{\{phone\}\}/gi, lead.phone?.trim() ?? "")
    .replace(/\{\{email\}\}/gi, lead.email?.trim() ?? "")
    .replace(/\{\{source\}\}/gi, lead.source?.trim() ?? "")
    .replace(/\{\{day_greeting\}\}/gi, dayGreeting());
}
