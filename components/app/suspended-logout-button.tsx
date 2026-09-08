"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Sem isso quem estiver logado numa conta suspensa fica preso na tela: nao
 * ha sidebar/topbar aqui (o layout normal nem chega a renderizar), entao o
 * "Sair" de sempre nao existe nesse ponto.
 */
export function SuspendedLogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className="mt-3 inline-flex h-9 w-full items-center justify-center text-xs font-medium text-white/40 transition-colors hover:text-white/70"
    >
      Sair
    </button>
  );
}
