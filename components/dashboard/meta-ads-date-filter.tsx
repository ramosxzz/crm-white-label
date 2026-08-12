"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { MetaDatePreset } from "@/lib/meta/ads-insights";

const OPTIONS: { value: MetaDatePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d", label: "7 dias" },
  { value: "last_30d", label: "30 dias" },
];

export function MetaAdsDateFilter({ current }: { current: MetaDatePreset }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startNav] = useTransition();

  function select(value: MetaDatePreset) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "today") {
      params.delete("ads");
    } else {
      params.set("ads", value);
    }
    const qs = params.toString();
    startNav(() => {
      router.push(qs ? `/dashboard?${qs}` : "/dashboard");
    });
  }

  return (
    <div className={cn("inline-flex rounded-lg border border-border/70 bg-background/60 p-0.5 transition-opacity", pending && "opacity-60")}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          disabled={pending}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            current === opt.value
              ? "bg-brand text-brand-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
