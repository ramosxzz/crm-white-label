export const TENANT_NAVIGATION_ITEMS = [
  { id: "dashboard", label: "Dashboard", group: "Visão geral", href: "/dashboard" },
  { id: "funnel", label: "Funil", group: "CRM", href: "/funil" },
  { id: "leads", label: "Leads", group: "CRM", href: "/leads" },
  { id: "service", label: "Atendimento", group: "CRM", href: "/atendimento" },
  { id: "tags", label: "Tags", group: "CRM", href: "/tags" },
  { id: "kanban", label: "Kanban", group: "CRM", href: "/kanban" },
  { id: "agenda", label: "Agenda", group: "Produtividade", href: "/agenda" },
  { id: "tasks", label: "Tarefas", group: "Produtividade", href: "/tarefas" },
  { id: "meetings", label: "Reuniões", group: "Produtividade", href: "/reunioes" },
  { id: "conversations", label: "Conversas", group: "Comunicação", href: "/chat" },
  { id: "team_chat", label: "Chat da equipe", group: "Comunicação", href: "/team-chat" },
  { id: "emails", label: "E-mails", group: "Comunicação", href: "/emails" },
  { id: "quick_messages", label: "Mensagens rápidas", group: "Comunicação", href: "/mensagens-rapidas" },
  { id: "calls", label: "Ligações", group: "Comunicação", href: "/ligacoes" },
  { id: "survey", label: "Pesquisa de satisfação", group: "Comunicação", href: "/pesquisa-satisfacao" },
  { id: "broadcasts", label: "Disparos", group: "Comunicação", href: "/disparos" },
  { id: "stock", label: "Estoque", group: "Gestão", href: "/estoque" },
  { id: "automations", label: "Automações", group: "Configurações", href: "/automations" },
  { id: "ai", label: "IA W+", group: "Configurações", href: "/ia-w-mais" },
  { id: "pipelines", label: "Configurar pipelines", group: "Configurações", href: "/pipelines" },
] as const;

export type TenantNavigationItemId = (typeof TENANT_NAVIGATION_ITEMS)[number]["id"];

export const TENANT_NAVIGATION_UPDATED_EVENT = "crm:tenant-navigation-updated";

export type TenantNavigationUpdatedDetail = {
  hiddenItems: TenantNavigationItemId[];
};

export function announceTenantNavigationUpdate(hiddenItems: TenantNavigationItemId[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TenantNavigationUpdatedDetail>(TENANT_NAVIGATION_UPDATED_EVENT, {
      detail: { hiddenItems },
    }),
  );
}

const TENANT_NAVIGATION_ITEM_IDS = new Set<string>(TENANT_NAVIGATION_ITEMS.map((item) => item.id));

export function normalizeHiddenNavigationItems(value: unknown): TenantNavigationItemId[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (item): item is TenantNavigationItemId =>
          typeof item === "string" && TENANT_NAVIGATION_ITEM_IDS.has(item),
      ),
    ),
  );
}

export function isNavigationItemEnabled(
  hiddenItems: readonly string[] | null | undefined,
  itemId: TenantNavigationItemId,
) {
  return !hiddenItems?.includes(itemId);
}

export function navigationItemForPath(pathname: string) {
  return [...TENANT_NAVIGATION_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function firstEnabledNavigationHref(hiddenItems: readonly string[] | null | undefined) {
  return TENANT_NAVIGATION_ITEMS.find((item) => isNavigationItemEnabled(hiddenItems, item.id))?.href ?? "/settings";
}
