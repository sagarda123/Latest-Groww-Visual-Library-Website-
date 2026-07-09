#!/usr/bin/env bash
# Push local auth.config.json credentials into Vercel env vars (production).
# Run once after `vercel link`. Values never echo to the terminal.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f auth.config.json ] || { echo "auth.config.json missing — run: node scripts/setup-auth.mjs <user> <pass>"; exit 1; }

field() { node -p "JSON.parse(require('fs').readFileSync('auth.config.json','utf8')).$1"; }

for pair in "AUTH_USERNAME username" "AUTH_SALT salt" "AUTH_PASSWORD_HASH passwordHash" "AUTH_HMAC_SECRET hmacSecret"; do
  set -- $pair
  vercel env rm "$1" production --yes >/dev/null 2>&1 || true
  field "$2" | tr -d '\n' | vercel env add "$1" production
  echo "set $1"
done
echo "Done. Redeploy with: vercel --prod"
