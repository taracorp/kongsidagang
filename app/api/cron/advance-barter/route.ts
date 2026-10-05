import { kedaluwarsakan } from "@/lib/domain/tukar";

export const dynamic = "force-dynamic";

/** Dipanggil crontab VPS (mis. tiap 10 menit): tawaran/kesepakatan Tukar Guling yang lewat batas → kedaluwarsa. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const expired = await kedaluwarsakan();
  return Response.json({ expired });
}
