#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-187.77.60.161}"
VPS_USER="${VPS_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/solaire-crm/app-src}"
REMOTE_COMPOSE="${REMOTE_COMPOSE:-docker-compose.vps.yml}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync nao encontrado. Instale rsync para fazer deploy na VPS." >&2
  exit 1
fi

echo "Validando build local antes de enviar..."
npm run build

echo "Criando backup rapido do codigo atual na VPS..."
ssh "${VPS_USER}@${VPS_HOST}" "set -e; mkdir -p /opt/solaire-crm/backups; if [ -d '${REMOTE_DIR}' ]; then tar -C '${REMOTE_DIR}' --exclude='.next' --exclude='node_modules' -czf /opt/solaire-crm/backups/app-src-\$(date +%Y%m%d-%H%M%S).tar.gz .; fi"

echo "Preparando diretorios de destino na VPS..."
ssh "${VPS_USER}@${VPS_HOST}" "set -e; mkdir -p '${REMOTE_DIR}/public/videos'"

echo "Sincronizando arquivos para ${VPS_HOST}:${REMOTE_DIR}..."
rsync -az --delete \
  --exclude '.git' \
  --exclude '.claude' \
  --exclude '.next' \
  --exclude '.open-next' \
  --exclude 'node_modules' \
  --exclude 'output' \
  --exclude 'tmp' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude 'supabase/.temp' \
  --exclude 'tsconfig.tsbuildinfo' \
  ./ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

echo "Reconstruindo container na VPS..."
ssh "${VPS_USER}@${VPS_HOST}" "set -e; cd '${REMOTE_DIR}'; test -f .env.production; set -a; . ./.env.production; set +a; docker compose -f '${REMOTE_COMPOSE}' up -d --build app"

echo "Verificando saude do CRM..."
ssh "${VPS_USER}@${VPS_HOST}" "set -e; curl -fsS --retry 10 --retry-delay 3 --retry-connrefused --retry-all-errors http://127.0.0.1:3000/api/health >/dev/null"

echo "Deploy VPS concluido."
