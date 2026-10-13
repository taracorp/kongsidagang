#!/usr/bin/env bash
# Deploy produksi dengan BUILD DI LAPTOP (VPS kekurangan memori untuk `next build`). Jalankan dari root repo:
#   bash scripts/deploy-lokal.sh <label-backup>        # mis. fase1
# Urutan: build commit HEAD (sudah di-push) di worktree → backup DB produksi → git pull + generate + migrate deploy di VPS
#         → rsync .next → tukar → pm2 reload → cek 200 di beberapa halaman, bila gagal otomatis kembali ke build lama.
# Syarat:
# - worktree build di ~/kdb/kongsidagang (nama folder HARUS "kongsidagang": symlink Turbopack di .next/node_modules
#   relatif ke nama folder build, dan di VPS foldernya /var/www/kongsidagang — Buku Kongsi Ch 8.32);
# - .env.production di worktree itu (NEXT_PUBLIC_* produksi + DATABASE_URL);
# - dependensi worktree sudah `npm ci` (ulangi bila package-lock berubah).
set -euo pipefail
export PATH=$HOME/.nvm/versions/node/v24.16.0/bin:$PATH

VPS=root@31.97.49.146
APP=/var/www/kongsidagang
BUILD=${KD_BUILD:-$HOME/kdb/kongsidagang}
LABEL=${1:?label backup, mis. fase1}
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=40 -o ServerAliveInterval=15 "$VPS")
REPO=$(cd "$(dirname "$0")/.." && pwd)
COMMIT=$(git -C "$REPO" rev-parse HEAD)

[ "$(basename "$BUILD")" = kongsidagang ] || { echo "Folder build harus bernama kongsidagang: $BUILD"; exit 1; }

# Turbopack menulis symlink .next/node_modules/<paket>-<hash> relatif terhadap akar yang ia tebak (bisa di atas folder
# proyek, mis. ../../../../kdb/kongsidagang/node_modules/pg) → putus di VPS. Tulis ulang jadi relatif DI DALAM proyek
# (../../node_modules/pg). Symlink yang menunjuk ke luar node_modules proyek → batal.
fix_symlink() {
  local root=$1 l t abs
  find "$root/.next/node_modules" -type l | while read -r l; do
    t=$(readlink "$l")
    abs=$(realpath -sm "$(dirname "$l")/$t")
    case "$abs" in
      "$root/node_modules/"*) ln -sfn "$(realpath -sm --relative-to="$(dirname "$l")" "$abs")" "$l" ;;
      *) echo "symlink asing: $l → $t"; exit 1 ;;
    esac
  done
}
git -C "$REPO" fetch -q origin
[ "$(git -C "$REPO" rev-parse origin/main)" = "$COMMIT" ] || { echo "HEAD belum di-push ke origin/main"; exit 1; }

# Build yang ada dipakai ulang bila commit-nya hanya berbeda di docs/, scripts/, atau *.md (tidak masuk .next).
DIBANGUN=$(cat "$BUILD/.next/KD_COMMIT" 2>/dev/null || true)
if [ -n "$DIBANGUN" ] && git -C "$REPO" diff --quiet "$DIBANGUN" "$COMMIT" -- . ':(exclude)docs' ':(exclude)scripts' ':(exclude)*.md'; then
  echo "== pakai build $DIBANGUN yang sudah ada (hapus $BUILD/.next untuk build ulang)"
else
  echo "== build $COMMIT di $BUILD"
  git -C "$BUILD" fetch -q origin
  git -C "$BUILD" checkout -q --detach "$COMMIT"
  (
    cd "$BUILD"
    set -a && . ./.env.production && set +a
    npx prisma generate >/dev/null
    rm -rf .next
    NODE_OPTIONS=--max-old-space-size=6144 npx next build
  )
  echo "$COMMIT" > "$BUILD/.next/KD_COMMIT"
fi
fix_symlink "$BUILD"

echo "== backup DB + git pull + migrasi di VPS"
"${SSH[@]}" "set -e
F=/root/backup-kongsi/kongsi-\$(date +%Y%m%d-%H%M)-pre-$LABEL.sql.gz
docker exec kongsi-db pg_dump -U kongsi -d kongsi | gzip > \$F
echo \"backup \$F (\$(zcat \$F | grep -c '^CREATE TABLE') tabel)\"
cd $APP
git pull -q --ff-only
[ \"\$(git rev-parse HEAD)\" = $COMMIT ] || { echo 'commit VPS berbeda'; exit 1; }
npx prisma generate >/dev/null
npx prisma migrate deploy 2>&1 | tail -4"

echo "== kirim build"
rsync -az --delete --exclude cache -e "ssh -o BatchMode=yes -o ConnectTimeout=40" "$BUILD/.next/" "$VPS:$APP/.next-baru/"

echo "== pasang (kembali otomatis ke build lama bila bukan 200)"
"${SSH[@]}" "set -e
cd $APP
rm -rf .next-lama
mv .next .next-lama && mv .next-baru .next
pm2 reload kongsidagang --update-env >/dev/null
sleep 6
for p in / /tukar /lapak /bayar /kabar; do
  c=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3020\$p)
  echo \"\$p \$c\"
  if [ \"\$c\" != 200 ]; then
    echo 'GAGAL → kembali ke build lama'
    rm -rf .next && mv .next-lama .next && pm2 reload kongsidagang >/dev/null
    exit 1
  fi
done
echo 'deploy OK'"
