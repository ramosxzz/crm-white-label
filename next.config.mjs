import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    // CSP permissivo em img/media/connect de proposito: o app renderiza
    // fotos de perfil do WhatsApp, midia do Meta/Instagram, emails HTML de
    // terceiro (iframe sandboxed, ja isolado) e chama varias APIs externas
    // (Supabase, Meta, Google, Sentry). Travar demais quebra integracao sem
    // ganho real - script-src e object-src sao os que realmente importam.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://connect.facebook.net https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "media-src 'self' https: blob:",
      "frame-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "solaire-w",
  project: "javascript-nextjs",
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
