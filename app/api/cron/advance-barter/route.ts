import { majukanTukar } from "@/lib/domain/tukar";

export const dynamic = "force-dynamic";

/**
 * Dipanggil crontab VPS (mis. tiap 10 menit): kedaluwarsa, konfirmasi otomatis paket sampai,
 * dan penahanan silang Tukar Guling.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await majukanTukar());
}
