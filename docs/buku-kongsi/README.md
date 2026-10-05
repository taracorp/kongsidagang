# 📖 Buku Kongsi Dagang

Catatan resmi perjalanan pembangunan **Kongsi Dagang**, disusun seperti buku: **Bab** = babak besar,
**Chapter** = satu perubahan/commit bermakna. Setiap perubahan pada repo **wajib** dicatat di sini.

## Daftar Isi

| Bab | Judul | Rentang | Tag rollback |
|---|---|---|---|
| [BAB 00](BAB-00-pendahuluan.md) | Pendahuluan — prinsip, stack, struktur | — | — |
| [BAB 01](BAB-01-fondasi.md) | Fondasi — setup & Fase A | 4 Jul 2026 | `kd-fase-a` |
| [BAB 02](BAB-02-fase-b-g.md) | Fase B–G — kerangka fitur (dummy) | 4–5 Jul 2026 | `kd-fase-b` … `kd-fase-g` |
| [BAB 03](BAB-03-wiring-db.md) | Wiring DB, Panggung, Admin, Fitur #1–#7 | 5–6 Jul 2026 | `kd-wiring-db`, `kd-panggung`, `kd-admin-web` |
| [BAB 04](BAB-04-milestone.md) | Milestone M1–M5 + Login Google | 6 Jul 2026 | `kd-m1` … `kd-m5`, `kd-auth-google` |
| [BAB 05](BAB-05-arsitektur.md) | Peta Arsitektur (dari Graphify) | snapshot `1163dc0` | — |
| [BAB 06](BAB-06-laporan-2026-10-05.md) | Laporan Terkini 5 Okt 2026 | — | — |
| [BAB 07](BAB-07-log-perubahan.md) | **Log Perubahan (Bab aktif)** | 5 Okt 2026 → | `kd-buku-kongsi` … |
| [Lampiran](LAMPIRAN-rollback.md) | Rollback — tag ↔ commit ↔ SQL + prosedur | — | semua |

## Aturan pencatatan (wajib)

1. **Setiap perubahan** (kode, SQL, config, konten) → tambah satu **Chapter** di Bab aktif
   (sekarang: [BAB 07](BAB-07-log-perubahan.md)), di commit yang **sama** dengan perubahannya.
2. **Selesai satu fase/milestone** → buat tag `kd-<nama>` (annotated) + tambah baris di
   [LAMPIRAN-rollback](LAMPIRAN-rollback.md). Fase besar baru boleh membuka Bab baru; update Daftar Isi.
3. Ada **SQL baru** → catat nomor migrasi, status apply (Tara apply manual), dan cara membatalkannya.
4. Setelah perubahan kode → `graphify update .` (refresh peta, tanpa biaya token).
5. Jangan menulis ulang Chapter lama. Koreksi = Chapter baru yang merujuk Chapter lama.

## Format Chapter

```markdown
### Ch X.Y — <judul>
`commit abc1234` · `tag kd-…` (jika ada) · YYYY-MM-DD

- **Tujuan:** kenapa perubahan ini dibuat
- **Perubahan:** file/route/komponen utama
- **SQL:** migrasi baru + status apply (atau "—")
- **Verifikasi:** tsc / lint / flow / screenshot
- **Rollback:** tag sebelumnya + catatan DB
```
