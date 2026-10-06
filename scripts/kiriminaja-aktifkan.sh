#!/usr/bin/env bash
# Aktifkan KiriminAja (Tukar Guling mode Kirim) setelah API key diisi. Jalankan DI VPS:
#   bash /var/www/kongsidagang/scripts/kiriminaja-aktifkan.sh
# Mendaftarkan URL webhook ke KiriminAja (POST /api/mitra/set_callback) lalu me-restart app.
set -euo pipefail
cd /var/www/kongsidagang
KEY=$(grep '^KIRIMINAJA_API_KEY=' .env | cut -d= -f2- | tr -d '"')
BASE=$(grep '^KIRIMINAJA_BASE_URL=' .env | cut -d= -f2- | tr -d '"')
BASE=${BASE:-https://client.kiriminaja.com}
SITE=$(grep '^BETTER_AUTH_URL=' .env | cut -d= -f2- | tr -d '"')
SITE=${SITE:-https://kongsidagang.store}
[ -n "$KEY" ] || { echo "KIRIMINAJA_API_KEY belum diisi di .env"; exit 1; }
echo "== daftarkan callback ${SITE}/api/kiriminaja/webhook"
curl -fsS -X POST "${BASE}/api/mitra/set_callback" \
  -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: Bearer ${KEY}" \
  -d "{\"url\":\"${SITE}/api/kiriminaja/webhook\"}"
echo
echo "== restart app"
pm2 restart kongsidagang --update-env
