export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Kongsi Dagang
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Platform kongsi dagang. Dibangun dengan Next.js dan Supabase.
      </p>
      <code className="rounded-lg bg-zinc-200 px-3 py-1 text-sm dark:bg-zinc-800">
        edit app/page.tsx
      </code>
    </div>
  );
}
