import Link from "next/link";
import { cn } from "@/lib/utils";

export type PageTabItem = {
  id: string;
  label: string;
  href: string;
};

export function PageTabs({ items, activeId, label }: { items: PageTabItem[]; activeId: string; label: string }) {
  return (
    <nav aria-label={label} className="overflow-x-auto border-b border-border/70">
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-11 items-center rounded-t-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
                active && "bg-muted/45 text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
