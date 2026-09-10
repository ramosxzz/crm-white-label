"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  KanbanSquare,
  MessageCircle,
  MoreHorizontal,
  Users,
  Wallet,
  Wrench,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileMenu } from "./mobile-menu-context";

const mobileItems = [
  { href: "/dashboard", label: "Inicio", icon: BarChart3 },
  { href: "/chat", label: "Conversas", icon: MessageCircle },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
];

type MoreItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export function MobileBottomNav({
  canManageFinance = false,
  osOnlyAccess = false,
  isProspeccao = false,
}: {
  stockEnabled?: boolean;
  satisfactionSurveyEnabled?: boolean;
  callsDashboardEnabled?: boolean;
  broadcastEnabled?: boolean;
  fieldServiceEnabled?: boolean;
  canManageFinance?: boolean;
  isSeller?: boolean;
  osOnlyAccess?: boolean;
  isProspeccao?: boolean;
}) {
  const pathname = usePathname();
  const { open: moreOpen, setOpen: setMoreOpen } = useMobileMenu();

  // Login restrito a Agenda/OS: barra inferior mostra so isso, nada do
  // resto do CRM.
  if (osOnlyAccess) {
    const items: MoreItem[] = [
      { href: "/os/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/os", label: "Lista de OS", icon: Wrench },
      ...(canManageFinance ? [{ href: "/financeiro", label: "Financeiro", icon: Wallet }] : []),
    ];
    return (
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-[0_-12px_30px_hsl(0_0%_0%/0.22)] backdrop-blur-xl md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={cn(
                  "mx-0.5 flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-[10px] font-semibold transition-colors",
                  active ? "bg-brand/15 text-brand" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="mb-0.5 h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <MobileMoreButton open={moreOpen} onOpen={() => setMoreOpen(true)} />
        </div>
      </nav>
    );
  }

  const primaryItems = isProspeccao
    ? [
        { href: "/prospeccao", label: "Prospecção", icon: UserPlus },
        { href: "/chat", label: "Conversas", icon: MessageCircle },
      ]
    : mobileItems;

  return (
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-[0_-12px_30px_hsl(0_0%_0%/0.22)] backdrop-blur-xl md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}>
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={cn(
                  "mx-0.5 flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-[10px] font-semibold transition-colors",
                  active ? "bg-brand/15 text-brand" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="mb-0.5 h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <MobileMoreButton open={moreOpen} onOpen={() => setMoreOpen(true)} />
        </div>
      </nav>
  );
}

function MobileMoreButton({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "mx-0.5 flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-[10px] font-semibold transition-colors",
        open ? "bg-brand-muted text-brand" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
      aria-expanded={open}
      aria-label="Abrir menu completo"
    >
      <MoreHorizontal className="mb-0.5 h-5 w-5" />
      <span className="max-w-full truncate">Mais</span>
    </button>
  );
}
