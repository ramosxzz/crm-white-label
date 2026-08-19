"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/** Login restrito a Agenda/OS (idosa que pediu tela clara, sem preto) - forca
 * o tema claro toda vez que essa conta entra, independente do que ficou
 * salvo no navegador antes. */
export function ForceLightTheme() {
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme("light");
  }, [setTheme]);
  return null;
}
