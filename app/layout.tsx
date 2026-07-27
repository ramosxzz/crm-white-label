import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
import { FeedbackProvider } from "@/components/ui/feedback-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Solaire W+ CRM",
    template: "%s · Solaire W+ CRM",
  },
  description:
    "Plataforma white-label de CRM para atendimento, vendas, agenda e automacoes.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  applicationName: "Solaire W+ CRM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Solaire CRM",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/apple-icon.svg",
  },
  openGraph: {
    title: "Solaire W+ CRM",
    description: "Plataforma white-label de CRM para atendimento, vendas, agenda e automacoes.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      style={{
        "--font-sans": "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        "--font-display": "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        "--font-mono": "JetBrains Mono, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace",
      } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <FeedbackProvider>
            {children}
            <PwaRegister />
          </FeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
