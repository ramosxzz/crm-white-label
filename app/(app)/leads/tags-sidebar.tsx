"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Tag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TagWithCount = { tag: string; count: number; leadIds: string[] };

export function TagsSidebar({ tags }: { tags: TagWithCount[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const activeTag = searchParams.get("tag");

  function selectTag(tag: string | null) {
    const qs = new URLSearchParams(searchParams.toString());
    if (tag) {
      qs.set("tag", tag);
    } else {
      qs.delete("tag");
    }
    qs.delete("page");
    startTransition(() => {
      router.push(qs.toString() ? `/leads?${qs}` : "/leads");
    });
  }

  if (tags.length === 0) return null;

  return (
    <aside className={cn(
      "hidden w-64 shrink-0 self-start border-b border-r border-border/70 bg-card lg:block",
      pending && "opacity-60",
    )}>
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Tags</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {tags.length}
        </Badge>
      </div>

      <div className="flex flex-col overflow-y-auto" style={{ maxHeight: "calc(100vh - 10rem)" }}>
        <button
          onClick={() => selectTag(null)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
            !activeTag && "bg-brand/10 font-medium text-brand",
          )}
        >
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">Todos os leads</span>
        </button>

        {tags.map(({ tag, count }) => (
          <button
            key={tag}
            onClick={() => selectTag(tag)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
              activeTag === tag && "bg-brand/10 font-medium text-brand",
            )}
          >
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{tag}</span>
            <Badge variant="outline" className="ml-auto shrink-0 text-[10px] tabular-nums">
              {count}
            </Badge>
          </button>
        ))}
      </div>
    </aside>
  );
}
