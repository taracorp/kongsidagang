#!/usr/bin/env bash
# Pasang / perbarui SearXNG (mesin pencari internal Juru Taksir) di VPS. Jalankan DI VPS:
#   bash /var/www/kongsidagang/scripts/searxng.sh
# Hanya terikat ke 127.0.0.1:8888 — dipanggil server Kongsi (SEARXNG_URL), tidak dibuka ke internet.
set -euo pipefail

NAME=kongsi-searxng
DIR=/opt/kongsi-searxng
SRC=${SRC:-/var/www/kongsidagang/deploy/searxng/settings.yml}

mkdir -p "$DIR"
cp "$SRC" "$DIR/settings.yml"
# Secret dibuat sekali, disimpan di luar repo.
[ -f "$DIR/secret" ] || openssl rand -hex 32 > "$DIR/secret"

docker pull searxng/searxng:latest
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  -p 127.0.0.1:8888:8080 \
  -v "$DIR:/etc/searxng" \
  -e SEARXNG_BASE_URL=http://127.0.0.1:8888/ \
  -e SEARXNG_SECRET="$(cat "$DIR/secret")" \
  --memory 384m \
  searxng/searxng:latest

sleep 6
curl -fsS -o /dev/null -w "SearXNG HTTP %{http_code}\n" "http://127.0.0.1:8888/search?q=tes&format=json"
