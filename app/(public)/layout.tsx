import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-brand text-brand-foreground font-display text-sm font-bold">
              S
            </div>
            <span className="font-display text-sm font-semibold">Solaire W+ CRM</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link href="/data-deletion" className="hover:text-foreground transition-colors">Excluir dados</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Termos</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {children}
      </main>

      <footer className="border-t mt-16">
        <div className="mx-auto max-w-4xl px-6 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Solaire W+ CRM · Todos os direitos reservados ·{" "}
          <a href="mailto:solairew3@gmail.com" className="hover:text-foreground">
            solairew3@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}
