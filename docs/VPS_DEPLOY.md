# Deploy na VPS

Este caminho roda o CRM em Docker com Caddy na frente. O Caddy cuida de HTTPS, proxy reverso e healthcheck.

## Por que assim

- Mantem o deploy Cloudflare como fallback enquanto a VPS e testada.
- Evita instalar Node, PM2 e Nginx manualmente no servidor.
- Permite trocar o dominio para a VPS apenas quando o teste estiver estavel.
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

Quando a VPS virar a URL principal, atualize os provedores para o novo dominio:

```txt
https://SEU_DOMINIO/api/webhooks/whatsapp/evolution
https://SEU_DOMINIO/api/webhooks/whatsapp/cloud_api
https://SEU_DOMINIO/api/webhooks/instagram
```

Enquanto estiver testando, mantenha Cloudflare como fallback e use um subdominio separado para a VPS, por exemplo:

```txt
crm-vps.seudominio.com.br
```

## O que me passar para eu subir

Nao envie senhas em texto solto. O ideal e passar por cofre/senha temporaria.

- IP da VPS.
- Usuario SSH com `sudo`.
- Dominio/subdominio que vai apontar para a VPS.
- Confirmacao de que o DNS ja aponta para o IP.
- Valores de `.env.production`.
- Se o banco continua no Supabase ou se vamos planejar migracao para Postgres na VPS.

## Minha recomendacao

Primeiro rode o CRM na VPS usando o mesmo Supabase. Se a navegacao melhorar mas mensagens continuarem atrasadas, o gargalo esta no caminho WhatsApp/Instagram -> webhook -> banco. Ai o proximo passo e separar processamento de webhooks em fila com retry.
