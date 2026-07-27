import { getAppBaseUrl } from "@/lib/app-url";
import { API_DOC_SECTIONS } from "@/lib/api/openapi-spec";

export const metadata = { title: "Documentação da API · Solaire W+ CRM" };

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export default async function ApiDocsPage() {
  const base = await getAppBaseUrl();
  const apiBase = `${base}/api/v1`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solaire W+ CRM</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Documentação da API</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          API REST por tenant pra conectar o CRM a outros sistemas. Gere uma chave em{" "}
          <span className="font-medium text-foreground">Integrações → API</span> dentro do CRM e envie no header
          abaixo em toda requisição.
        </p>
        <code className="mt-4 block break-all rounded-lg border border-border/70 bg-muted/40 px-4 py-3 font-mono text-xs">
          Authorization: Bearer sk_live_...
        </code>
        <p className="mt-3 text-sm text-muted-foreground">
          Endpoint base: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{apiBase}</code>
        </p>
      </header>

      <nav className="mb-10 flex flex-wrap gap-2">
        {API_DOC_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-muted-foreground hover:border-brand/40 hover:text-brand"
          >
            {section.title}
          </a>
        ))}
      </nav>

      <div className="mb-10 rounded-lg border border-border/70 bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Erros</span> seguem o formato{" "}
          <code className="rounded bg-muted px-1">{`{ "error": { "code": "...", "message": "..." } }`}</code>. Limite
          de 120 requisições por minuto por chave (HTTP 429 se exceder).
        </p>
      </div>

      <div className="space-y-14">
        {API_DOC_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-6">
            <h2 className="font-display text-xl font-semibold">{section.title}</h2>
            <div className="mt-4 space-y-8">
              {section.endpoints.map((endpoint) => (
                <div key={`${endpoint.method}-${endpoint.path}`} className="rounded-xl border border-border/70 bg-card/50 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${METHOD_COLORS[endpoint.method]}`}>
                      {endpoint.method}
                    </span>
                    <code className="font-mono text-sm">{endpoint.path}</code>
                    {endpoint.scope && (
                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                        escopo: {endpoint.scope}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-medium">{endpoint.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{endpoint.description}</p>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exemplo</p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                    {endpoint.curl.replace("SEU_DOMINIO", base.replace(/^https?:\/\//, ""))}
                  </pre>

                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resposta</p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                    {endpoint.response}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
