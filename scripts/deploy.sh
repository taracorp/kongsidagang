#!/usr/bin/env bash
# Deploy / update Kongsi Dagang di VPS (31.97.49.146). Jalankan DI VPS:
#   bash /var/www/kongsidagang/scripts/deploy.sh
# Pola sama dengan app lain di VPS: pm2 + next start, route Traefik di
# /data/coolify/proxy/dynamic/kongsidagang.yml → http://172.17.0.1:3020
set -euo pipefail

APP_DIR=/var/www/kongsidagang
PORT=3020
NAME=kongsidagang

cd "$APP_DIR"
echo "== git pull"
git pull --ff-only

echo "== npm ci (postinstall: prisma generate)"
npm ci

echo "== migrasi DB produksi"
npx prisma migrate deploy

echo "== build"
npm run build

echo "== pm2"
if pm2 describe "$NAME" >/dev/null 2>&1; then
  pm2 reload "$NAME" --update-env
else
  pm2 start node_modules/.bin/next --name "$NAME" --cwd "$APP_DIR" -- start --hostname 0.0.0.0 --port "$PORT"
fi
pm2 save

echo "== cek"
sleep 3
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:$PORT/"
