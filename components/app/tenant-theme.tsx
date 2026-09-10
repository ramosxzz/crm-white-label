"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { tenantBrandCssVars } from "@/lib/theme/brand-colors";

const THEME_KEYS = [
  "--brand",
  "--brand-active",
  "--brand-foreground",
  "--brand-muted",
  "--accent",
  "--accent-foreground",
  "--ring",
  "--chat-outbound",
  "--chat-outbound-foreground",
  "--chat-outbound-meta",
  "--aqua",
] as const;

export function TenantTheme({ brandColor }: { brandColor: string | null }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    if (!brandColor?.trim()) {
      for (const key of THEME_KEYS) root.style.removeProperty(key);
      return;
    }

    const scheme = resolvedTheme === "dark" ? "dark" : "light";
    const vars = tenantBrandCssVars(brandColor, scheme);
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    return () => {
      for (const key of THEME_KEYS) root.style.removeProperty(key);
    };
  }, [brandColor, resolvedTheme]);

  return null;
}
