# Kongsi Dagang

Platform kongsi dagang dibangun dengan **Next.js 16** (App Router) dan **Supabase**.

## Tech Stack

- [Next.js 16](https://nextjs.org) — App Router, TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) — auth & database via `@supabase/ssr`

## Setup

1. Install dependency:

   ```bash
   npm install
   ```

2. Salin env dan isi kredensial Supabase (dari Project Settings > API):

   ```bash
   cp .env.local.example .env.local
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
lib/supabase/        Supabase client (browser & server) + helper sesi
proxy.ts             Refresh sesi Supabase (pengganti middleware di Next 16)
```

## Perintah

| Perintah          | Fungsi                    |
| ----------------- | ------------------------- |
| `npm run dev`     | Jalankan dev server       |
| `npm run build`   | Build production          |
| `npm run start`   | Jalankan hasil build      |
| `npm run lint`    | Lint kode                 |
