"use client";

import { Component, type ReactNode } from "react";

/**
 * O MapLibre inicializa a GPU dentro de um efeito: quando falha, o erro sobe
 * pro error boundary da rota e apaga a tela inteira, sidebar e tudo. Este
 * boundary segura a falha no tamanho do mapa e mostra o plano B no lugar.
 *
 * Precisa ser classe - React so oferece captura de erro de renderizacao em
 * componente de classe.
 */
export class MapBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Falha ao carregar o mapa das OS:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
