"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function PrintOnOpen() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
      Salvar como PDF
    </Button>
  );
}
