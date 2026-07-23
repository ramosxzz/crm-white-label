"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Frequentes",
    emojis: ["😀", "😂", "😉", "😍", "🥰", "😘", "😎", "🤔", "😅", "😢", "😭", "😡", "👍", "👎", "🙏", "👏", "💪", "🔥", "✅", "❌"],
  },
  {
    label: "Coração",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕"],
  },
  {
    label: "Gestos",
    emojis: ["👋", "🤝", "✌️", "🤞", "👌", "☝️", "👉", "👈", "💯", "🎉"],
  },
  {
    label: "Negócio",
    emojis: ["💰", "💵", "📈", "📉", "📦", "🛒", "🏷️", "⏰", "📅", "📞"],
  },
];

export function EmojiPickerButton({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden h-12 w-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground sm:inline-flex"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        title="Emoji"
      >
        <Smile className="h-5 w-5" />
      </Button>

      {open && (
        <div
          className={cn(
            "absolute bottom-full left-0 z-10 mb-2 max-h-72 w-72 overflow-y-auto rounded-2xl border border-border bg-popover p-3 shadow-lg",
          )}
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-8 gap-1">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-lg p-1 text-lg leading-none hover:bg-muted"
                    onClick={() => {
                      onPick(emoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
