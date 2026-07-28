import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Solaire W+ CRM",
    short_name: "Solaire CRM",
    description: "CRM white-label para atendimento, vendas, agenda e automacoes.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#0c0e12",
    theme_color: "#0c0e12",
    orientation: "any",
    categories: ["business", "productivity"],
    lang: "pt-BR",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Conversas",
        short_name: "Chat",
        description: "Abrir conversas",
        url: "/chat",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Leads",
        short_name: "Leads",
        description: "Abrir leads",
        url: "/leads",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Agenda",
        short_name: "Agenda",
        description: "Abrir agenda",
        url: "/agenda",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Campo",
        short_name: "Campo",
        description: "Ordens de servico do dia",
        url: "/campo",
        icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
