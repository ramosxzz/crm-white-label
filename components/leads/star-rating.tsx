"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  onChange,
  size = "sm",
}: {
  value: number;
  onChange: (stars: number) => void;
  size?: "sm" | "md";
}) {
  const starSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          title={`${n} estrela${n > 1 ? "s" : ""}`}
          className="text-muted-foreground transition-colors hover:text-amber-400"
        >
          <Star className={cn(starSize, n <= value && "fill-amber-400 text-amber-400")} />
        </button>
      ))}
    </div>
  );
}
