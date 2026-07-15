"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CalendarCheck,
  KanbanSquare,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
  Users,
  Boxes,
  Zap,
  Bot,
  Heart,
  PhoneCall,
  GitBranch,
  Plug,
  UserCog,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const mobileItems = [
  { href: "/dashboard", label: "Inicio", icon: BarChart3 },
  { href: "/chat", label: "Conversas", icon: MessageCircle },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
];

type MoreItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export function MobileBottomNav({
  stockEnabled = true,
  satisfactionSurveyEnabled = false,
  callsDashboardEnabled = false,
}: {
  stockEnabled?: boolean;
  satisfactionSurveyEnabled?: boolean;
  callsDashboardEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const operationItems: MoreItem[] = [
    { href: "/reunioes", label: "Reuniões", icon: CalendarCheck },
    { href: "/mensagens-rapidas", label: "Mensagens rápidas", icon: MessageSquareText },
    ...(stockEnabled ? [{ href: "/estoque", label: "Estoque", icon: Boxes }] : []),
    { href: "/automations", label: "Automações", icon: Zap },
    { href: "/ia-w-mais", label: "IA W+", icon: Bot },
    ...(satisfactionSurveyEnabled
      ? [{ href: "/pesquisa-satisfacao", label: "Pesquisa de Satisfação", icon: Heart }]
      : []),
    ...(callsDashboardEnabled ? [{ href: "/ligacoes", label: "Ligações", icon: PhoneCall }] : []),
  ];

  const systemItems: MoreItem[] = [
    { href: "/pipelines", label: "Funis", icon: GitBranch },
    { href: "/integrations", label: "Integrações", icon: Plug },
    { href: "/settings/users", label: "Usuários", icon: UserCog },
    { href: "/settings", label: "Configurações", icon: Settings },
  ];

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 shadow-2xl">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between px-5 py-2">
              <p className="font-display text-base font-semibold">Menu</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <MoreSection title="Operação" items={operationItems} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
            <MoreSection title="Sistema" items={systemItems} pathname={pathname} onNavigate={() => setMoreOpen(false)} />

            <div className="px-3 pb-2 pt-1">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-[0_-12px_30px_hsl(0_0%_0%/0.22)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-6">
          {mobileItems.map((item) => {
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
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "mx-0.5 flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-[10px] font-semibold transition-colors",
              moreOpen ? "bg-brand/15 text-brand" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <MoreHorizontal className="mb-0.5 h-5 w-5" />
            <span className="max-w-full truncate">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function MoreSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: MoreItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="px-3 py-1">
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                active ? "bg-brand/15 text-brand" : "text-foreground hover:bg-muted/60",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
