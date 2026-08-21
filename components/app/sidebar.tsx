"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  KanbanSquare,
  ListChecks,
  Users,
  MessageCircle,
  MessageSquareText,
  Mail,
  FolderKanban,
  UserPlus,
  BarChart3,
  Boxes,
  Settings,
  LogOut,
  Plug,
  GitBranch,
  CalendarDays,
  CalendarCheck,
  Zap,
  UserCog,
  Heart,
  PhoneCall,
  Bot,
  Megaphone,
  Filter,
  Timer,
  Wallet,
  Wrench,
  List,
  Route,
  Map as MapIcon,
  Tags,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const operationItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/funil", label: "Funil", icon: Filter },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/atendimento", label: "Atendimento", icon: Timer },
  { href: "/tags", label: "Tags", icon: Tags },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
  { href: "/reunioes", label: "Reuniões", icon: CalendarCheck },
  { href: "/estoque", label: "Estoque", icon: Boxes },
];

const communicationItems = [
  { href: "/chat", label: "Conversas", icon: MessageCircle },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/mensagens-rapidas", label: "Mensagens rápidas", icon: MessageSquareText },
  { href: "/ligacoes", label: "Ligações", icon: PhoneCall },
  { href: "/pesquisa-satisfacao", label: "Pesquisa de Satisfação", icon: Heart },
  { href: "/disparos", label: "Disparos", icon: Megaphone },
];

const secondaryItems = [
  { href: "/automations", label: "Automacoes", icon: Zap },
  { href: "/ia-w-mais", label: "IA W+", icon: Bot },
  { href: "/pipelines", label: "Funis", icon: GitBranch },
  { href: "/integrations", label: "Integracoes", icon: Plug },
  { href: "/settings/users", label: "Usuarios", icon: UserCog },
  { href: "/settings", label: "Configuracoes", icon: Settings, exact: true },
];

export function Sidebar({
  tenantName,
  tenantLogoUrl,
  tenantTagline,
  stockEnabled = true,
  satisfactionSurveyEnabled = false,
  callsDashboardEnabled = false,
  broadcastEnabled = false,
  fieldServiceEnabled = false,
  leadFoldersEnabled = false,
  canManageFinance = false,
  canManageFieldService = false,
  isSeller = false,
  isProspeccao = false,
  osOnlyAccess = false,
  userName,
  userEmail,
}: {
  tenantName: string;
  tenantLogoUrl: string | null;
  tenantTagline?: string | null;
  stockEnabled?: boolean;
  satisfactionSurveyEnabled?: boolean;
  callsDashboardEnabled?: boolean;
  broadcastEnabled?: boolean;
  fieldServiceEnabled?: boolean;
  leadFoldersEnabled?: boolean;
  canManageFinance?: boolean;
  canManageFieldService?: boolean;
  isSeller?: boolean;
  isProspeccao?: boolean;
  osOnlyAccess?: boolean;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  // Vendedor nao gerencia estoque, automacoes, IA W+, integracoes, usuarios,
  // nem ve o dashboard de reunioes (mostra receita/custo/ROI do tenant
  // inteiro - a mesma pagina ja redireciona se um vendedor acessar direto).
  const sellerBlocked = new Set(["/estoque", "/automations", "/ia-w-mais", "/integrations", "/settings/users", "/funil", "/atendimento", "/reunioes", "/ligacoes", "/os", "/os/roteiro", "/os/mapa"]);
  // Login restrito a Agenda/OS: so ve o que e do modulo de servico em campo,
  // nada do resto do CRM (chat, leads, kanban...).
  // Vendedora fecha a venda abrindo a OS e para por ai: ve so a Agenda, pra
  // consultar horario livre do tecnico na hora de marcar com o cliente.
  // Lista de OS, roteiro e mapa sao operacao de campo, do escritorio.
  // Cadastro de parceiro saiu daqui: quem cadastra e a prospeccao (Jeruza),
  // na tela dela (a rota continua existindo pra quem tiver o link).
  const fieldServiceItems = isSeller
    ? [{ href: "/os/agenda", label: "Agenda de OS", icon: CalendarDays, exact: true }]
    : [
        { href: "/os/agenda", label: "Agenda de OS", icon: CalendarDays, exact: true },
        { href: "/os", label: "Lista de OS", icon: List, exact: true },
        { href: "/os/roteiro", label: "Roteiro", icon: Route, exact: true },
        { href: "/os/mapa", label: "Mapa", icon: MapIcon, exact: true },
      ];
  const visibleOperationItems = osOnlyAccess || isProspeccao
    ? []
    : operationItems.filter((item) => {
        if (isSeller && sellerBlocked.has(item.href)) return false;
        if (item.href === "/estoque") return stockEnabled;
        return true;
      });
  // Prospeccao (Jeruza): atende WhatsApp igual as vendedoras, mas nada mais
  // de Comunicacao (disparo em massa, etc) - so Conversas.
  const visibleCommunicationItems = osOnlyAccess
    ? []
    : isProspeccao
      ? communicationItems.filter((item) => item.href === "/chat")
      : communicationItems.filter((item) => {
          if (isSeller && sellerBlocked.has(item.href)) return false;
          if (item.href === "/pesquisa-satisfacao") return satisfactionSurveyEnabled;
          if (item.href === "/ligacoes") return callsDashboardEnabled;
          if (item.href === "/disparos") return broadcastEnabled;
          return true;
        });
  const folderItems = [
    { href: "/pastas?folder=primeiro_contato", label: "Primeiro contato", icon: FolderKanban },
    { href: "/pastas?folder=reaplicacao", label: "Reaplicação", icon: FolderKanban },
    { href: "/pastas?folder=mkt", label: "MKT", icon: FolderKanban },
  ];
  const visibleFolderItems = !osOnlyAccess && !isProspeccao && leadFoldersEnabled ? folderItems : [];
  const visibleFieldServiceItems = !isProspeccao && (osOnlyAccess || fieldServiceEnabled)
    ? [
        ...fieldServiceItems,
        ...(canManageFinance
          ? [{ href: "/financeiro", label: "Financeiro", icon: Wallet }]
          : []),
      ]
    : [];
  const visibleSecondaryItems = osOnlyAccess || isProspeccao
    ? []
    : secondaryItems.filter((item) => !(isSeller && sellerBlocked.has(item.href)));
  const visibleProspeccaoItems = isProspeccao
    ? [{ href: "/prospeccao", label: "Prospecção", icon: UserPlus }]
    : [];

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="group/sidebar sticky top-0 hidden h-screen w-[4.75rem] shrink-0 overflow-hidden flex-col border-r border-border bg-card shadow-[inset_-1px_0_0_hsl(var(--foreground)/0.04)] transition-[width] duration-200 ease-out hover:w-64 dark:border-border/50 dark:bg-card/75 md:flex">
      <div className="flex h-[4.75rem] shrink-0 items-center justify-center border-b border-border/40 px-3 group-hover/sidebar:justify-start">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-background font-display text-sm font-semibold text-brand ring-1 ring-border/70">
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantLogoUrl} alt={tenantName} className="h-full w-full rounded-2xl object-cover" />
          ) : (
            initials(tenantName)
          )}
        </div>
        <div className="ml-0 max-w-0 overflow-hidden opacity-0 transition-all duration-150 group-hover/sidebar:ml-3 group-hover/sidebar:max-w-[10rem] group-hover/sidebar:opacity-100">
          <p className="truncate text-sm font-semibold leading-tight">{tenantName}</p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {tenantTagline?.trim() || "CRM"}
          </p>
        </div>
      </div>

      <nav className="sidebar-scrollbar flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {visibleProspeccaoItems.length > 0 && (
          <NavGroup
            label="Prospecção"
            icon={UserPlus}
            items={visibleProspeccaoItems}
            pathname={pathname}
            defaultOpen
          />
        )}
        {visibleOperationItems.length > 0 && (
          <NavGroup
            label="Operação"
            icon={LayoutGrid}
            items={visibleOperationItems}
            pathname={pathname}
            defaultOpen
          />
        )}
        {visibleCommunicationItems.length > 0 && (
          <NavGroup
            label="Comunicação"
            icon={MessageCircle}
            items={visibleCommunicationItems}
            pathname={pathname}
          />
        )}
        {visibleFolderItems.length > 0 && (
          <NavGroup
            label="Pastas"
            icon={FolderKanban}
            items={visibleFolderItems}
            pathname={pathname}
          />
        )}
        {visibleFieldServiceItems.length > 0 && (
          <NavGroup
            label="Ordens de serviço"
            icon={Wrench}
            items={visibleFieldServiceItems}
            pathname={pathname}
            defaultOpen={osOnlyAccess}
          />
        )}
        {visibleSecondaryItems.length > 0 && (
          <NavGroup
            label="Sistema"
            icon={Settings}
            items={visibleSecondaryItems}
            pathname={pathname}
          />
        )}
      </nav>

      <div className="shrink-0 border-t border-border/40 p-3">
        <div className="flex h-12 w-full items-center justify-center gap-0 rounded-xl bg-background/35 ring-1 ring-border/35 transition-colors duration-150 hover:bg-brand/10 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-2">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-brand/15 text-[11px] font-semibold text-brand">
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="max-w-0 flex-1 overflow-hidden opacity-0 transition-all duration-150 group-hover/sidebar:max-w-[10rem] group-hover/sidebar:opacity-100">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{userEmail}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-0 shrink-0 overflow-hidden p-0 opacity-0 transition-all duration-150 group-hover/sidebar:w-9 group-hover/sidebar:opacity-100"
            onClick={logout}
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

type SidebarItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

function itemIsActive(item: SidebarItem, pathname: string) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavGroup({
  label,
  icon: Icon,
  items,
  pathname,
  defaultOpen = false,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SidebarItem[];
  pathname: string;
  defaultOpen?: boolean;
}) {
  const groupActive = items.some((item) => itemIsActive(item, pathname));
  const [open, setOpen] = useState(defaultOpen || groupActive);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group flex h-10 w-full items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-brand/10 hover:text-foreground group-hover/sidebar:justify-start",
          groupActive && "text-foreground",
        )}
        aria-expanded={open}
        title={label}
      >
        <Icon className={cn("h-5 w-5 shrink-0 transition-colors", groupActive && "text-brand")} />
        <span className="max-w-0 flex-1 overflow-hidden truncate whitespace-nowrap text-left opacity-0 transition-all duration-150 group-hover/sidebar:max-w-[9rem] group-hover/sidebar:opacity-100">
          {label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-0 shrink-0 opacity-0 transition-[width,opacity,transform] duration-200 group-hover/sidebar:w-4 group-hover/sidebar:opacity-100",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1">
            {items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} nested />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  nested = false,
}: {
  item: SidebarItem;
  pathname: string;
  nested?: boolean;
}) {
  const Icon = item.icon;
  const active = itemIsActive(item, pathname);
  return (
    <Link
      href={item.href}
      prefetch
      className={cn(
        "group relative flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-[padding,color,background-color] duration-150 group-hover/sidebar:justify-start",
        nested && "group-hover/sidebar:pl-5",
        active
          ? "bg-brand-muted text-foreground dark:bg-brand/10"
          : "text-muted-foreground hover:bg-brand/10 hover:text-foreground dark:hover:bg-brand/15",
      )}
      title={item.label}
    >
      {active && (
        <span
          className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand"
          aria-hidden
        />
      )}
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors duration-150",
          active ? "text-brand" : "text-muted-foreground group-hover:text-brand",
        )}
      />
      <span className="max-w-0 overflow-hidden truncate whitespace-nowrap opacity-0 transition-all duration-150 group-hover/sidebar:max-w-[10rem] group-hover/sidebar:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}
