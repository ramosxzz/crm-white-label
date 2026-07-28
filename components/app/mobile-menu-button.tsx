"use client";

import { Menu } from "lucide-react";
import { useMobileMenu } from "./mobile-menu-context";

export function MobileMenuButton() {
  const { setOpen } = useMobileMenu();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mr-auto rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground md:hidden"
      aria-label="Abrir menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
