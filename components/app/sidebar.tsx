"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  KanbanSquare,
  ListChecks,
  Users,
  MessageCircle,
  MessageSquareText,
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
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/funil", label: "Funil", icon: Filter },
  { href: "/atendimento", label: "Atendimento", icon: Timer },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks },
  { href: "/reunioes", label: "Reuniões", icon: CalendarCheck },
  { href: "/chat", label: "Conversas", icon: MessageCircle },
  { href: "/mensagens-rapidas", label: "Mensagens rápidas", icon: MessageSquareText },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/automations", label: "Automacoes", icon: Zap },
  { href: "/ia-w-mais", label: "IA W+", icon: Bot },
  { href: "/pesquisa-satisfacao", label: "Pesquisa de Satisfação", icon: Heart },
  { href: "/ligacoes", label: "Ligações", icon: PhoneCall },
  { href: "/disparos", label: "Disparos", icon: Megaphone },
  { href: "/os", label: "Ordens de serviço", icon: Wrench },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
];

const secondaryItems = [
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
  canManageFinance = false,
  isSeller = false,
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
  canManageFinance?: boolean;
  isSeller?: boolean;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  // Vendedor nao gerencia estoque, automacoes, IA W+, integracoes, usuarios,
  // nem ve o dashboard de reunioes (mostra receita/custo/ROI do tenant
  // inteiro - a mesma pagina ja redireciona se um vendedor acessar direto).
  const sellerBlocked = new Set(["/estoque", "/automations", "/ia-w-mais", "/integrations", "/settings/users", "/funil", "/atendimento", "/reunioes", "/ligacoes"]);
  const visibleNavItems = navItems.filter((item) => {
    if (isSeller && sellerBlocked.has(item.href)) return false;
    if (item.href === "/estoque") return stockEnabled;
    if (item.href === "/pesquisa-satisfacao") return satisfactionSurveyEnabled;
    if (item.href === "/ligacoes") return callsDashboardEnabled;
    if (item.href === "/disparos") return broadcastEnabled;
    if (item.href === "/os") return fieldServiceEnabled;
    // Financeiro e so da gestao (owner/admin), alem de exigir o modulo.
    if (item.href === "/financeiro") return fieldServiceEnabled && canManageFinance;
    return true;
  });
  const visibleSecondaryItems = secondaryItems.filter(
    (item) => !(isSeller && sellerBlocked.has(item.href)),
  );

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

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <div className="h-0 overflow-hidden px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground opacity-0 transition-all duration-150 group-hover/sidebar:mb-1.5 group-hover/sidebar:h-4 group-hover/sidebar:opacity-100">
          Operacao
        </div>
        {visibleNavItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="h-0 overflow-hidden px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground opacity-0 transition-all duration-150 group-hover/sidebar:mb-1.5 group-hover/sidebar:mt-6 group-hover/sidebar:h-4 group-hover/sidebar:opacity-100">
          Sistema
        </div>
        {visibleSecondaryItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
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
  );
}

function NavLink({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
  pathname: string;
}) {
  const Icon = item.icon;
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      prefetch
      className={cn(
        "group relative flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 group-hover/sidebar:justify-start",
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
