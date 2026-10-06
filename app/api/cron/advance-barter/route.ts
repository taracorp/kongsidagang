import { majukanTukar } from "@/lib/domain/tukar";
import { kadaluarsakanVoucher } from "@/lib/domain/belanja";

export const dynamic = "force-dynamic";

/**
 * Dipanggil crontab VPS (mis. tiap 10 menit): kedaluwarsa, konfirmasi otomatis paket sampai,
 * penahanan silang Tukar Guling, dan Surat Jalan yang lewat masa berlaku.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const tukar = await majukanTukar();
  const voucherKadaluarsa = await kadaluarsakanVoucher();
  return Response.json({ ...tukar, voucherKadaluarsa });
}
