/**
 * Erros que significam "essa aba esta com o bundle de uma versao anterior".
 *
 * Sao dois sintomas do mesmo problema:
 * 1. Server Action com id que o servidor novo nao reconhece.
 * 2. Chunk que sumiu - rota com import dinamico (o mapa das OS, por exemplo)
 *    pede um arquivo que o deploy novo substituiu, e o import falha.
 *
 * Nos dois casos "tentar novamente" nao resolve, porque roda o mesmo bundle
 * velho de novo. A recuperacao certa e recarregar a pagina.
 */
const STALE_MARKERS = [
  "Failed to find Server Action",
  "was not found on the server",
  // Import dinamico apontando pra um chunk que nao existe mais. Cada
  // navegador tem a sua mensagem, por isso a lista.
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
];

function matchesStaleMarker(haystack: string): boolean {
  return STALE_MARKERS.some((marker) => haystack.includes(marker));
}

export function isStaleDeploymentError(error: Error | null | undefined): boolean {
  // O ChunkLoadError do webpack carrega a identificacao no `name`, nao na
  // mensagem - olhar so a mensagem deixaria ele passar batido.
  return matchesStaleMarker(`${error?.name ?? ""} ${error?.message ?? ""}`);
}

/**
 * Mesma deteccao, mas pra quando so sobrou o texto (ex.: um catch que ja
 * formatou a mensagem antes de mostrar um toast, sem guardar o Error
 * original). Os marcadores sao strings tecnicas em ingles que o Next gera -
 * nunca algo que alguem escreveria a mao numa mensagem de erro em
 * portugues, entao o risco de falso positivo e essencialmente zero.
 */
export function isStaleDeploymentMessage(text: string | null | undefined): boolean {
  return matchesStaleMarker(text ?? "");
}
