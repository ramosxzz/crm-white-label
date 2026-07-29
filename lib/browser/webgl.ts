/**
 * O MapLibre desenha o mapa na GPU e exige WebGL2 - sem ele o construtor
 * lanca GPUInitializationError de dentro de um efeito, o que derruba a tela
 * inteira no error boundary.
 *
 * Nao e caso raro: acontece com aceleracao de hardware desligada no navegador,
 * driver de video antigo em maquina de escritorio, maquina virtual sem GPU e
 * extensao de privacidade que bloqueia canvas. Por isso a checagem vem antes
 * de montar o mapa, e nao depois de quebrar.
 */
export function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return false;
    // Libera o contexto: navegador tem limite de contextos WebGL vivos e este
    // aqui serve so pra responder a pergunta.
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
