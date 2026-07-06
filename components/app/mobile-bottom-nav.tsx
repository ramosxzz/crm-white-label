"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, KanbanSquare, MessageCircle, MoreHorizontal, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileItems = [
  { href: "/dashboard", label: "Inicio", icon: BarChart3 },
  { href: "/chat", label: "Conversas", icon: MessageCircle },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/settings", label: "Mais", icon: MoreHorizontal },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
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
                active
                  ? "bg-brand/15 text-brand"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="mb-0.5 h-5 w-5" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
