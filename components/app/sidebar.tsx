"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  KanbanSquare,
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
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/app/brand-logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/reunioes", label: "Reuniões", icon: CalendarCheck },
  { href: "/chat", label: "Conversas", icon: MessageCircle },
  { href: "/mensagens-rapidas", label: "Mensagens rápidas", icon: MessageSquareText },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/automations", label: "Automacoes", icon: Zap },
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
  userName,
  userEmail,
}: {
  tenantName: string;
  tenantLogoUrl: string | null;
  tenantTagline?: string | null;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card shadow-[inset_-1px_0_0_hsl(var(--foreground)/0.04)] dark:border-border/50 dark:bg-card/75">
      <div className="flex items-center border-b border-border/40 px-4 py-4">
        <BrandLogo
          size="sm"
          tenantLogoUrl={tenantLogoUrl}
          tenantName={tenantName}
          tagline={tenantTagline}
        />
      </div>

      <Link
        href="/settings"
        prefetch
        className="group mx-3 mt-3 flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 p-2.5 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] transition-colors duration-150 hover:border-brand/35 hover:bg-brand/10"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-brand/15 font-display text-xs font-semibold text-brand ring-1 ring-border/50">
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantLogoUrl} alt={tenantName} className="h-full w-full object-cover" />
          ) : (
            initials(tenantName)
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold leading-tight">{tenantName}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Workspace</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 pt-4">
        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Operacao
        </div>
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="mb-1.5 mt-6 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sistema
        </div>
        {secondaryItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="border-t border-border/40 p-3">
        <div className="flex items-center gap-2.5 rounded-lg p-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-brand/15 text-xs font-semibold text-brand">
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{userEmail}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout} aria-label="Sair">
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
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150",
        active
          ? "bg-brand-muted text-foreground dark:bg-brand/10"
          : "text-muted-foreground hover:bg-brand/10 hover:text-foreground dark:hover:bg-brand/15",
      )}
    >
      {active && (
        <span
          className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand"
          aria-hidden
        />
      )}
      <Icon
        className={cn(
          "h-4 w-4 transition-colors duration-150",
          active ? "text-brand" : "text-muted-foreground group-hover:text-brand",
        )}
      />
      {item.label}
    </Link>
  );
}
