import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MarketingSite } from "@/components/marketing/marketing-site";

// solairew.com.br mostra a apresentacao pesada (Prism/DecryptedText/video);
// crm.solairew.com.br (uso diario, PC as vezes fraco) vai direto pro login
// enxuto. Mesmo container atras do Caddy, decide so pelo Host.
const MARKETING_HOSTS = new Set(["solairew.com.br", "www.solairew.com.br"]);

export default async function HomePage() {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? "";
  if (MARKETING_HOSTS.has(host)) {
    return <MarketingSite />;
  }
  redirect("/login");
}
