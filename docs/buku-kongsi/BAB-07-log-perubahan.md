# BAB 07 — Log Perubahan (Bab aktif)

Setiap perubahan baru dicatat di sini sebagai Chapter berurutan (lihat format di [README](README.md)).

### Ch 7.1 — Buku Kongsi, titik rollback, laporan terkini
`commit 3b31848` · `tag kd-buku-kongsi` · 2026-10-05

- **Tujuan:** catatan perubahan berbentuk buku, kemampuan rollback per fase, laporan status.
- **Perubahan:**
  - `docs/buku-kongsi/` (README, BAB 00–07, LAMPIRAN-rollback) — isi Bab 01–04 diturunkan dari `git log --stat`.
  - 16 tag rollback annotated `kd-fase-a` … `kd-auth-google` pada commit lama (lokal, belum di-push).
  - `AGENTS.md`: BAGIAN 10 — aturan wajib-catat Buku Kongsi.
  - `.gitignore`: `graphify-out/` (peta Graphify lokal, tidak di-commit).
- **SQL:** —
- **Verifikasi:** `npx tsc --noEmit` ✅, `npm run lint` ✅, `git tag -l 'kd-*'` = 17 tag.
- **Rollback:** `kd-auth-google` (perubahan ini hanya dokumentasi).
