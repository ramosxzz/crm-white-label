"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  KanbanSquare,
  ListChecks,
  Users,
  Users2,
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
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { markTeamChatRead } from "@/app/(app)/team-chat/actions";
import { useMobileMenu } from "@/components/app/mobile-menu-context";

const overviewItems = [{ href: "/dashboard", label: "Dashboard", icon: BarChart3 }];

// "Funil" (relatorio analitico) e "Kanban" (quadro operacional) parecem
// duplicados mas nao sao: um mostra metrica por etapa (tempo medio, valor),
// o outro e onde o lead e arrastado de fato. Mantidos separados de proposito.
const crmItems = [
  { href: "/funil", label: "Funil", icon: Filter },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/atendimento", label: "Atendimento", icon: Timer },
  { href: "/tags", label: "Tags", icon: Tags },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
];

const productivityItems = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
  { href: "/reunioes", label: "Reuniões", icon: CalendarCheck },
];

const managementItems = [{ href: "/estoque", label: "Estoque", icon: Boxes }];

const communicationItems = [
  { href: "/chat", label: "Conversas", icon: MessageCircle },
  { href: "/team-chat", label: "Chat da equipe", icon: Users2 },
  { href: "/emails", label: "E-mails", icon: Mail },
  { href: "/mensagens-rapidas", label: "Mensagens rápidas", icon: MessageSquareText },
  { href: "/ligacoes", label: "Ligações", icon: PhoneCall },
  { href: "/pesquisa-satisfacao", label: "Pesquisa de Satisfação", icon: Heart },
  { href: "/disparos", label: "Disparos", icon: Megaphone },
];

const secondaryItems = [
  { href: "/automations", label: "Automações", icon: Zap },
  { href: "/ia-w-mais", label: "IA W+", icon: Bot },
  { href: "/pipelines", label: "Configurar pipelines", icon: GitBranch },
  { href: "/integrations", label: "Integrações", icon: Plug },
  { href: "/settings/users", label: "Usuários", icon: UserCog },
  { href: "/settings", label: "Configurações gerais", icon: Settings, exact: true },
];

export function Sidebar({
  tenantId,
  userId,
  unreadTeamChat: initialUnreadTeamChat = 0,
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
  tenantId: string;
  userId: string;
  unreadTeamChat?: number;
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
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileMenu();
  const [unreadTeamChat, setUnreadTeamChat] = useState(initialUnreadTeamChat);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`sidebar-team-chat-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as { sender_id: string };
          if (row.sender_id !== userId) setUnreadTeamChat((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, userId]);

  const skipInitialMarkReadRef = useRef(true);
  useEffect(() => {
    if (!pathname.startsWith("/team-chat")) return;
    setUnreadTeamChat(0);
    // Pula a chamada da Server Action no carregamento direto/hard-reload: ela
    // competia com o streaming SSR ainda em andamento e travava a pagina no
    // loading.tsx. Numa navegacao de verdade (clicando no link) ja nao ha
    // stream concorrente, entao dispara normal.
    if (skipInitialMarkReadRef.current) {
      skipInitialMarkReadRef.current = false;
      return;
    }
    void markTeamChatRead();
  }, [pathname]);
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
  const hiddenForRole = osOnlyAccess || isProspeccao;
  const visibleOverviewItems = hiddenForRole ? [] : overviewItems;
  const visibleCrmItems = hiddenForRole
    ? []
    : crmItems.filter((item) => !(isSeller && sellerBlocked.has(item.href)));
  const visibleProductivityItems = hiddenForRole
    ? []
    : productivityItems.filter((item) => !(isSeller && sellerBlocked.has(item.href)));
  const visibleManagementItems = hiddenForRole
    ? []
    : managementItems.filter((item) => {
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

  const navGroups = useMemo<NavGroupDefinition[]>(
    () =>
      [
        { id: "prospeccao", label: "Prospecção", icon: UserPlus, items: visibleProspeccaoItems },
        { id: "overview", label: "Visão geral", icon: LayoutGrid, items: visibleOverviewItems },
        { id: "crm", label: "CRM", icon: Users, items: visibleCrmItems },
        { id: "productivity", label: "Produtividade", icon: CalendarCheck, items: visibleProductivityItems },
        {
          id: "communication",
          label: "Comunicação",
          icon: MessageCircle,
          items: visibleCommunicationItems,
          badges: unreadTeamChat > 0 ? { "/team-chat": unreadTeamChat } : undefined,
        },
        { id: "folders", label: "Pastas", icon: FolderKanban, items: visibleFolderItems },
        { id: "management", label: "Gestão", icon: Boxes, items: visibleManagementItems },
        {
          id: "field-service",
          label: "Ordens de serviço",
          icon: Wrench,
          items: visibleFieldServiceItems,
        },
        { id: "settings", label: "Configurações", icon: Settings, items: visibleSecondaryItems },
      ].filter((group) => group.items.length > 0),
    [
      unreadTeamChat,
      visibleCommunicationItems,
      visibleCrmItems,
      visibleFieldServiceItems,
      visibleFolderItems,
      visibleManagementItems,
      visibleOverviewItems,
      visibleProductivityItems,
      visibleProspeccaoItems,
      visibleSecondaryItems,
    ],
  );
  const activeGroupId = navGroups.find((group) =>
    group.items.some((item) => itemIsActive(item, pathname)),
  )?.id;
  const [openGroupId, setOpenGroupId] = useState<string | null>(activeGroupId ?? navGroups[0]?.id ?? null);

  useEffect(() => {
    if (activeGroupId) setOpenGroupId(activeGroupId);
  }, [activeGroupId]);

  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current !== pathname) setMobileOpen(false);
    previousPathname.current = pathname;
  }, [pathname, setMobileOpen]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const toggleGroup = (groupId: string) => {
    setOpenGroupId((current) => (current === groupId ? null : groupId));
  };

  return (
    <>
    <aside className="group/sidebar sticky top-0 hidden h-[100dvh] w-[4.75rem] shrink-0 overflow-hidden flex-col border-r border-border bg-card shadow-[inset_-1px_0_0_hsl(var(--foreground)/0.04)] transition-[width] duration-200 ease-out hover:w-64 dark:border-border/50 dark:bg-card/75 md:flex">
      <div className="flex h-[4.75rem] shrink-0 items-center justify-center border-b border-border/40 px-3 group-hover/sidebar:justify-start">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-background font-display text-sm font-semibold text-brand ring-1 ring-border/70">
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantLogoUrl} alt={tenantName} className="h-full w-full rounded-xl object-cover" />
          ) : (
            initials(tenantName)
          )}
        </div>
        <div className="ml-0 max-w-0 overflow-hidden opacity-0 transition-all duration-150 group-hover/sidebar:ml-3 group-hover/sidebar:max-w-[10rem] group-hover/sidebar:opacity-100" title={tenantName}>
          <p className="truncate text-sm font-semibold leading-tight">{tenantName}</p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {tenantTagline?.trim() || "CRM"}
          </p>
        </div>
      </div>

      <nav className="sidebar-scrollbar flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-3" aria-label="Navegação principal">
        {navGroups.map((group) => (
          <NavGroup
            key={group.id}
            {...group}
            pathname={pathname}
            open={openGroupId === group.id}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}
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

    <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-foreground/35 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 md:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-[71] flex w-[min(88vw,20rem)] flex-col border-r border-border bg-card shadow-elev-3 outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-left motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:slide-out-to-left md:hidden" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <DialogPrimitive.Title className="sr-only">Menu principal</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Navegação do CRM</DialogPrimitive.Description>
          <div className="flex h-[4.75rem] shrink-0 items-center gap-3 border-b border-border/60 px-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-background font-display text-sm font-semibold text-brand ring-1 ring-border/70">
              {tenantLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenantLogoUrl} alt={tenantName} className="h-full w-full rounded-xl object-cover" />
              ) : initials(tenantName)}
            </div>
            <div className="min-w-0 flex-1" title={tenantName}>
              <p className="truncate text-sm font-semibold">{tenantName}</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{tenantTagline?.trim() || "CRM"}</p>
            </div>
            <DialogPrimitive.Close asChild><Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Fechar menu"><X className="h-5 w-5" /></Button></DialogPrimitive.Close>
          </div>
          <nav className="sidebar-scrollbar flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-3" aria-label="Navegação mobile">
            {navGroups.map((group) => (
              <NavGroup
                key={group.id}
                {...group}
                pathname={pathname}
                open={openGroupId === group.id}
                onToggle={() => toggleGroup(group.id)}
                expanded
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </nav>
          <div className="shrink-0 border-t border-border/60 p-3">
            <div className="flex min-h-12 items-center gap-3 rounded-xl bg-background/40 px-2 ring-1 ring-border/40">
              <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="bg-brand-muted text-[11px] font-semibold text-brand">{initials(userName)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{userName}</p><p className="truncate text-[11px] text-muted-foreground">{userEmail}</p></div>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={logout} aria-label="Sair"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    </>
  );
}

type SidebarItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavGroupDefinition = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SidebarItem[];
  badges?: Record<string, number>;
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
  open,
  onToggle,
  badges,
  expanded = false,
  onNavigate,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SidebarItem[];
  pathname: string;
  open: boolean;
  onToggle: () => void;
  badges?: Record<string, number>;
  expanded?: boolean;
  onNavigate?: () => void;
}) {
  const groupActive = items.some((item) => itemIsActive(item, pathname));
  const groupBadgeTotal = badges ? Object.values(badges).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group flex h-10 w-full items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground group-hover/sidebar:justify-start",
          expanded && "justify-start",
          groupActive && "text-foreground",
        )}
        aria-expanded={open}
        title={label}
      >
        <span className="relative shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
          {groupBadgeTotal > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
              {groupBadgeTotal > 99 ? "99+" : groupBadgeTotal}
            </span>
          )}
        </span>
        <span className={cn("max-w-0 flex-1 overflow-hidden truncate whitespace-nowrap text-left opacity-0 transition-all duration-150 group-hover/sidebar:max-w-[9rem] group-hover/sidebar:opacity-100", expanded && "max-w-none opacity-100")}>
          {label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-0 shrink-0 opacity-0 transition-[width,opacity,transform] duration-200 group-hover/sidebar:w-4 group-hover/sidebar:opacity-100",
            expanded && "w-4 opacity-100",
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
              <NavLink key={item.href} item={item} pathname={pathname} nested badge={badges?.[item.href]} expanded={expanded} onNavigate={onNavigate} />
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
  badge,
  expanded = false,
  onNavigate,
}: {
  item: SidebarItem;
  pathname: string;
  nested?: boolean;
  badge?: number;
  expanded?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = itemIsActive(item, pathname);
  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-[padding,color,background-color] duration-150 group-hover/sidebar:justify-start",
        nested && "group-hover/sidebar:pl-5",
        expanded && nested && "justify-start pl-5",
        active
          ? "bg-brand-muted text-brand-active dark:bg-brand/15"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
      title={item.label}
    >
      <span className="relative shrink-0">
        <Icon
          className={cn(
            "h-5 w-5 transition-colors duration-150",
            active ? "text-brand-active" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        {!!badge && badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className={cn("max-w-0 flex-1 overflow-hidden truncate whitespace-nowrap opacity-0 transition-all duration-150 group-hover/sidebar:max-w-[10rem] group-hover/sidebar:opacity-100", expanded && "max-w-none opacity-100")}>
        {item.label}
      </span>
      {!!badge && badge > 0 && (
        <span className="hidden shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground opacity-0 transition-opacity duration-150 group-hover/sidebar:inline-block group-hover/sidebar:opacity-100">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
