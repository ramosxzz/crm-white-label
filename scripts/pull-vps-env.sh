#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-187.77.60.161}"
VPS_USER="${VPS_USER:-root}"
REMOTE_ENV="${REMOTE_ENV:-/opt/solaire-crm/app-src/.env.production}"
LOCAL_ENV="${LOCAL_ENV:-.env.local}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

scp "${VPS_USER}@${VPS_HOST}:${REMOTE_ENV}" "$tmp"
cp "$tmp" "$LOCAL_ENV"

if grep -q '^NEXT_PUBLIC_APP_URL=' "$LOCAL_ENV"; then
  sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=http://localhost:3000|' "$LOCAL_ENV"
else
  printf '\nNEXT_PUBLIC_APP_URL=http://localhost:3000\n' >> "$LOCAL_ENV"
fi

chmod 600 "$LOCAL_ENV"
echo "Arquivo ${LOCAL_ENV} atualizado a partir da VPS."
