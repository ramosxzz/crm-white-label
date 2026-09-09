# Deploy na VPS

Este caminho roda o CRM em Docker com Caddy na frente. O Caddy cuida de HTTPS, proxy reverso e healthcheck.

## Por que assim

- Este e o ambiente oficial de producao do CRM.
- Evita instalar Node, PM2 e Nginx manualmente no servidor.
- Mantem a aplicacao empacotada e reproduzivel entre deploys.
- Deixa `/api/health` disponivel para diagnostico rapido.

## Requisitos da VPS

- Ubuntu 22.04 ou 24.04.
- Docker e Docker Compose instalados.
- Portas `80` e `443` abertas no firewall.
- Um dominio ou subdominio apontando para o IP da VPS.

## Arquivos importantes

- `Dockerfile`: imagem de producao do Next.js.
- `docker-compose.vps.yml`: app + Caddy.
- `deploy/vps/Caddyfile`: HTTPS e proxy reverso.
- `.env.production`: variaveis reais de producao, nao versionar.

## Primeira subida

No servidor:

```bash
git clone <URL_DO_REPOSITORIO> solaire-crm
cd solaire-crm
cp .env.production.example .env.production
```

Edite `.env.production` com as chaves reais e o dominio da VPS:

```bash
nano .env.production
```

Para midias grandes do chat, configure tambem o Cloudflare R2:

```bash
CLOUDFLARE_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=solaire-chat-media
```

Depois suba:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.production up -d --build
```

O compose passa `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` tambem como argumentos de build, porque o Next.js embute variaveis `NEXT_PUBLIC_*` no bundle do navegador.

Verifique:

```bash
docker compose -f docker-compose.vps.yml ps
curl -I https://SEU_DOMINIO/api/health
```

## Atualizar depois

```bash
git pull
docker compose -f docker-compose.vps.yml --env-file .env.production up -d --build
docker image prune -f
```

## Webhooks

Configure os provedores com o dominio oficial da VPS:

```txt
https://SEU_DOMINIO/api/webhooks/whatsapp/evolution
https://SEU_DOMINIO/api/webhooks/whatsapp/cloud_api
https://SEU_DOMINIO/api/webhooks/instagram
```

O dominio atual e `crm.solairew.com.br`. Nao envie senhas em texto solto; mantenha o acesso SSH e as variaveis de producao nos secrets do GitHub e no arquivo protegido da VPS.
