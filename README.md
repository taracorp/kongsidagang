# Kongsi Dagang

Platform kongsi dagang dibangun dengan **Next.js 16** (App Router), **Prisma 7** + Postgres, dan **Better Auth**.
Berjalan di VPS sendiri: https://kongsidagang.store

## Tech Stack

- [Next.js 16](https://nextjs.org) — App Router, TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Prisma](https://www.prisma.io) — ORM untuk Postgres 16 (VPS)
- [Better Auth](https://www.better-auth.com) — login email+sandi & Google

## Setup

1. Install dependency:

   ```bash
   npm install
   ```

2. Salin env, isi `DATABASE_URL` dll., lalu buka tunnel ke DB VPS
   (`ssh -N -L 5434:127.0.0.1:5434 root@31.97.49.146`), migrasi & seed:

   ```bash
   cp .env.local.example .env.local
   npx prisma migrate dev
   npm run seed
   ```

3. Jalankan dev server:

   ```bash
   npm run dev
   ```

   Buka http://localhost:3000

## Struktur

```
app/                 Route & halaman (App Router)
components/          Komponen UI reusable
app/actions/         Server Actions (semua tulis data)
lib/db.ts            PrismaClient · lib/auth.ts Better Auth · lib/queries.ts baca data
lib/domain/          Logika bisnis (lelang, pundi, saudagar)
prisma/              schema.prisma, migrations/, seed.ts
docs/buku-kongsi/    Buku catatan perubahan & rollback
```

## Perintah

| Perintah          | Fungsi                    |
| ----------------- | ------------------------- |
| `npm run dev`     | Jalankan dev server       |
| `npm run build`   | Build production          |
| `npm run start`   | Jalankan hasil build      |
| `npm run lint`    | Lint kode                 |
| `npm run seed`    | Isi data awal (Prisma)    |
| `npm run flow`    | Tes alur penuh (Playwright) |
| `scripts/deploy.sh` | Deploy ulang di VPS     |
