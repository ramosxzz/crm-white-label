"use client";

import { createContext, useContext, useState } from "react";

type MobileMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const MobileMenuContext = createContext<MobileMenuContextValue | null>(null);

export function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MobileMenuContext.Provider value={{ open, setOpen }}>{children}</MobileMenuContext.Provider>;
}

export function useMobileMenu() {
  const ctx = useContext(MobileMenuContext);
  if (!ctx) throw new Error("useMobileMenu precisa estar dentro de MobileMenuProvider");
  return ctx;
}
