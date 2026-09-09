"use client";

import { usePathname } from "next/navigation";

const OS_DETAIL_RE = /^\/os\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Esconde a Sidebar (e qualquer filho) so na tela de uma OS aberta (o
 * "workspace" que da lugar pra agenda do dia - ver OsWorkspaceRail).
 *
 * Antes essa decisao vinha do header x-pathname, lido via headers() no
 * layout (Server Component). Depois de qualquer Server Action com
 * revalidatePath, o Next reaproveita o segmento de layout ja renderizado -
 * e esse header podia vir de uma renderizacao anterior (ex.: a ultima vez
 * que passou pela OS), fazendo a barra inteira sumir em QUALQUER tela ate
 * dar F5. usePathname() e do client router: reflete sempre a URL real,
 * sem depender de qual request gerou o header.
 */
export function OsWorkspaceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (OS_DETAIL_RE.test(pathname ?? "")) return null;
  return <>{children}</>;
}
